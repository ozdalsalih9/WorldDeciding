import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireBase = process.env.DOCGEN_REQUIRE_BASE
  ? path.join(process.env.DOCGEN_REQUIRE_BASE, "package.json")
  : __filename;
const require = createRequire(pathToFileURL(requireBase));
const PDFDocument = require("pdfkit");
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LeaderType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} = require("docx");
const root = path.resolve(__dirname, "..");
const outDir = path.join(__dirname, "deliverables");
const assetsDir = path.join(__dirname, "assets", "project-images");

fs.mkdirSync(outDir, { recursive: true });

const title = "Design and Development of a Web Platform for Cross-Cultural Opinion Analysis";
const projectName = "WorldDeciding";
const generatedDate = "May 1, 2026";
const thesisDateTr = "03 Nisan 2026";

const refs = [
  {
    id: 1,
    text:
      "R. Inglehart et al., World Values Survey, Center for Political Studies, University of Michigan. " +
      "The WVS is an international research program studying social, political, economic, religious, and cultural values across more than 120 countries. Accessed: May 1, 2026.",
    url: "https://cps.isr.umich.edu/projects/world-values-survey-wvs/",
  },
  {
    id: 2,
    text:
      "European Social Survey, Methodology Overview. The ESS highlights the methodological difficulty of measuring attitudes cross-nationally and the need for high quality comparative survey design. Accessed: May 1, 2026.",
    url: "https://www.europeansocialsurvey.org/methodology/methodology-overview",
  },
  {
    id: 3,
    text:
      "B. Pang and L. Lee, Opinion Mining and Sentiment Analysis, Foundations and Trends in Information Retrieval, vol. 2, no. 1-2, pp. 1-135, 2008, doi: 10.1561/1500000011.",
    url: "https://www.nowpublishers.com/article/Details/INR-011",
  },
  {
    id: 4,
    text:
      "Microsoft Learn, Configure ASP.NET Core Identity. Identity supports configurable password, lockout, claims, and cookie options for web applications. Accessed: May 1, 2026.",
    url: "https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-configuration",
  },
  {
    id: 5,
    text:
      "Redis, Rate Limiting. Rate limiting controls the number of requests a client can make during a period to protect system stability, security, and fair use. Accessed: May 1, 2026.",
    url: "https://redis.io/glossary/rate-limiting/",
  },
  {
    id: 6,
    text:
      "Npgsql Documentation, Npgsql - .NET Access to PostgreSQL. Npgsql is an open source ADO.NET provider and includes an Entity Framework Core provider for PostgreSQL. Accessed: May 1, 2026.",
    url: "https://www.npgsql.org/",
  },
  {
    id: 7,
    text:
      "OWASP Developer Guide, Application Security Verification Standard. ASVS is used to identify security gaps and verify web applications across authentication, session management, access control, validation, cryptography, and API controls. Accessed: May 1, 2026.",
    url: "https://devguide.owasp.org/en/11-security-gap-analysis/01-guides/02-asvs/",
  },
  {
    id: 8,
    text:
      "Docker Documentation, Compose overview. Docker Compose is used to define and run multi-container applications with services, networks, and volumes. Accessed: May 1, 2026.",
    url: "https://docs.docker.com/compose/",
  },
];

const screenshots = {
  home1: "main page1.png",
  home2: "main page2.png",
  home3: "main page3.png",
  questions: "questions page.png",
  eitherOr: "either or page.png",
  stats1: "stats page1.png",
  stats2: "stats page2.png",
  countryCompare: "country comparison page.png",
  countryCompare2: "country comparison page2.png",
  comment: "comment page.png",
  aiSummary: "Comment AI Summary.png",
  leaderboard: "leaderboard page.png",
  profile: "profile page.png",
  publicProfile: "public profile page.png",
  categories: "categories page.png",
  login: "login page.png",
  register: "register page.png",
  adminPanel: "admin panel page.png",
  adminQuestions: "admin questions page.png",
  adminCategories: "admin categories page.png",
  bulkImport: "bulk import page.png",
  ga4: "GA4 Analytics page.png",
};

function imgPath(name) {
  const full = path.join(assetsDir, name);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing screenshot asset: ${name}`);
  }
  return full;
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 1, 4) !== "PNG") {
    return { width: 1200, height: 800 };
  }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function docText(text, opts = {}) {
  const runs = [];
  if (opts.boldLabel) {
    runs.push(new TextRun({ text: opts.boldLabel, bold: true }));
  }
  runs.push(
    new TextRun({
      text,
      bold: opts.bold,
      italics: opts.italics,
      size: opts.size ?? 22,
      color: opts.color,
    })
  );
  return new Paragraph({
    children: runs,
    alignment: opts.alignment,
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0, line: opts.line ?? 320 },
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 220, after: 160 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    text,
    bullet: { level },
    spacing: { after: 90, line: 300 },
  });
}

function numbered(text) {
  return new Paragraph({
    text,
    numbering: { reference: "main-numbering", level: 0 },
    spacing: { after: 90, line: 300 },
  });
}

function table(headers, rows, widths = []) {
  const headerCells = headers.map((h, i) =>
    new TableCell({
      width: { size: widths[i] ?? Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      shading: { fill: "EAF2F8" },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerCells, tableHeader: true }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell, i) =>
                new TableCell({
                  width: { size: widths[i] ?? Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
                  children: [docText(String(cell), { after: 40, size: 20, line: 260 })],
                })
            ),
          })
      ),
    ],
  });
}

function formTitle(text, before = 520) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });
}

function formBody(text, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 160, line: opts.line ?? 360 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24 })],
  });
}

function rightFormText(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120, line: opts.line ?? 300 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24 })],
  });
}

function tocLine(text, page, opts = {}) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9150, leader: LeaderType.DOT }],
    indent: { left: opts.left ?? 0 },
    spacing: { before: 0, after: opts.after ?? 72, line: opts.line ?? 260 },
    children: [
      new TextRun({ text, bold: opts.bold ?? true, italics: opts.italics, size: opts.size ?? 24 }),
      new TextRun({ text: `\t${page}`, bold: opts.bold ?? true, italics: opts.italics, size: opts.size ?? 24 }),
    ],
  });
}

function plainCenteredTitle(text, before = 420) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before, after: 220 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });
}

function textRunsWithBreaks(text, props = {}) {
  return String(text)
    .split("\n")
    .map((line, index) => new TextRun({ text: line, break: index === 0 ? 0 : 1, ...props }));
}

function minutesCell(text, opts = {}) {
  return new TableCell({
    columnSpan: opts.columnSpan,
    verticalAlign: opts.verticalAlign ?? VerticalAlign.CENTER,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.alignment ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: opts.line ?? 220 },
        children: textRunsWithBreaks(text, { bold: opts.bold, size: opts.size ?? 18 }),
      }),
    ],
  });
}

function oralExamMinutesPage() {
  const rows = [
    new TableRow({
      children: [
        minutesCell("BM401 BİLGİSAYAR MÜHENDİSLİĞİ PROJE TASARIMI / BM498\nMEZUNİYET TEZİ\nDEĞERLENDİRME VE SÖZLÜ SINAV TUTANAĞI", {
          columnSpan: 3,
          bold: true,
          size: 22,
          alignment: AlignmentType.CENTER,
          line: 240,
        }),
      ],
    }),
    new TableRow({ children: [minutesCell("ÖĞRENCİLER (NUMARA/AD-SOYAD):", { columnSpan: 3, size: 18 })] }),
    new TableRow({ children: [minutesCell("DANIŞMAN:", { columnSpan: 3, size: 18 })] }),
    new TableRow({
      children: [
        minutesCell("Değerlendirme Kriteri", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 76 }),
        minutesCell("Puan\nAralığı", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 12 }),
        minutesCell("Puan", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 12 }),
      ],
    }),
    new TableRow({ children: [minutesCell("Yazılı Çalışma Biçimsel Değerlendirme (10 Puan)", { columnSpan: 3, shading: "D9D9D9", bold: true })] }),
    ...[
      ["Çalışma kılavuza uygun olarak hazırlanmış mı?", "0-10"],
      ["Problemin tanımı açıkça yapılmış mı?", "0-5"],
      ["Literatür taraması yeterli, güncel ve sistematik bir yaklaşımla (PRISMA vb.) gerçekleştirilmiş mi?", "0-5"],
      ["Geliştirilecek yazılımın/donanımın mimarisini içeren blok şeması (yazılımlar için veri akış şeması da olabilir) çizilerek açıklanmış mı?", "0-5"],
      ["Kullanılan materyal ve metot yeterli düzeyde anlatılmış mı?", "0-5"],
      ["Projede kullanılan veri setleri FAIR (Findable, Accessible, Interoperable, Reusable) ilkelerine uygun şekilde yönetilmiş mi?", "0-5"],
      ["Tasarımın uygulamasında ortaya çıkan uyumsuzluklar ve aksaklıklar belirtilerek çözüm yöntemleri tartışılmış mı?", "0-5"],
      ["Yapılan işlerin zorluk derecesi?", "0-5"],
      ["Yapılan sunum başarılı mı?", "0-8"],
      ["Soruları yanıtlama yetkinliği?", "0-7"],
      ["Öğrenci dönem içerisindeki raporlarını düzenli olarak hazırladı mı?", "0-10"],
    ].map(([criterion, range]) =>
      new TableRow({
        children: [
          minutesCell(criterion, { size: 17 }),
          minutesCell(range, { size: 17, alignment: AlignmentType.CENTER }),
          minutesCell("", { size: 17 }),
        ],
      })
    ),
    new TableRow({ children: [minutesCell("Etik ve Mesleki Sorumluluk (15 Puan)", { columnSpan: 3, shading: "D9D9D9", bold: true })] }),
    ...[
      ["Proje etik ilkelere uygun mu? (İntihal, etik beyan, veri ve yapay zekâ kullanımı, insan verisi kullanımı - Helsinki Deklarasyonu vb.).\n☐ İntihal beyanı mevcut. ☐ ISO 690 uygun kaynak gösterimi. ☐ İnsan verisi kullanılmışsa etik izin / onam mevcut. ☐ Helsinki Deklarasyonu ilkelerine uygunluk.", "0-5"],
      ["Projede mühendislik etiği ve mesleki sorumluluk bilinciyle hareket edilmiş mi?", "0-5"],
      ["Mühendislik uygulamalarında ulusal/uluslararası standartlar belirtilmiş (ISO 9001, ISO 17025, IEEE) ve uygulanmış mı?", "0-5"],
      ["Proje sürecinde proje yönetimi, risk yönetimi ve değişiklik yönetimi yaklaşımları uygulanmış mı? (İş planı, görev dağılımı, risk analizi)", "0-4"],
      ["Girişimcilik ve yenilikçilik boyutu değerlendirilmiş mi? (Özgün çözüm, katma değer, ticari potansiyel)", "0-4"],
      ["Sürdürülebilir kalkınma perspektifi (çevresel, ekonomik ve sosyal sürdürülebilirlik) gözetilmiş mi?", "0-4"],
      ["Sürdürülebilir Yazılım Geliştirmede Yeniden Üretilebilirlik (Reproducibility) ilkesi uygulanmış mı?", "0-3"],
    ].map(([criterion, range]) =>
      new TableRow({
        children: [
          minutesCell(criterion, { size: 17 }),
          minutesCell(range, { size: 17, alignment: AlignmentType.CENTER }),
          minutesCell("", { size: 17 }),
        ],
      })
    ),
    new TableRow({
      children: [
        minutesCell("Toplam", { shading: "D9D9D9", bold: true }),
        minutesCell("0-100", { shading: "D9D9D9", alignment: AlignmentType.CENTER }),
        minutesCell("", { shading: "D9D9D9" }),
      ],
    }),
  ];

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
      },
      rows,
    }),
    pageBreak(),
  ];
}

function declarationPage() {
  return [
    formTitle("BEYAN", 820),
    formBody(
      "Bu tez çalışmasının kendi çalışmam olduğunu, tezin planlanmasından yazımına kadar bütün aşamalarda etik dışı davranışımın olmadığını, bu tezdeki bütün bilgileri akademik ve etik kurallar içinde elde ettiğimi, bu tez çalışmasıyla elde edilmeyen bütün bilgi ve yorumlara kaynak gösterdiğimi ve bu kaynakları da kaynaklar listesine aldığımı, yine bu tezin çalışılması ve yazımı sırasında patent ve telif haklarını ihlal edici bir davranışımın olmadığını beyan ederim.",
      { before: 120, after: 920 }
    ),
    rightFormText(thesisDateTr, { after: 220 }),
    rightFormText("(İmza)", { after: 120 }),
    rightFormText("(Öğrencinin Adı Soyadı)", { after: 80 }),
    pageBreak(),
  ];
}

function generativeAiDeclarationPage() {
  return [
    formTitle("ÜRETKEN YAPAY ZEKA KULLANIM BEYANI", 620),
    rightFormText(thesisDateTr, { before: 240, after: 360, bold: true }),
    formBody(
      "Bu tez çalışmasını hazırlarken……………………………… (ChatGPT, Gemini, DALL-E vb.) üretken yapay zekâ programlarından destek aldığımı/almadığımı beyan ederim. Tezimin hazırlığı aşamasında üretken yapay zekâ programlarından (örn: dil çevirisi, bilimsel makaleye erişim vb.) desteği aldım. Üretken yapay zekâ programlarından aldığım bilgilerin doğruluğunu kontrol ettiğimi bildiririm.",
      { after: 220 }
    ),
    formBody(
      "Herhangi bir zamanda, çalışmamla ilgili yaptığım bu beyana aykırı bir durumun saptanması durumunda, ortaya çıkacak tüm ahlaki ve hukuki sonuçları kabul ettiğimi bildiririm.",
      { after: 760 }
    ),
    rightFormText("(İmza)", { after: 260 }),
    rightFormText("(Öğrencinin Adı Soyadı)", { after: 80 }),
    pageBreak(),
  ];
}

function acknowledgementsPage() {
  return [
    formTitle("TEŞEKKÜR", 560),
    formBody("Lisans öğrenimimde ve bu tezin hazırlanmasında gösterdiği her türlü destek ve yardımdan dolayı çok değerli hocam Prof. Dr. Xxxxx Xxxxx’e en içten dileklerimle teşekkür ederim."),
    formBody("Tez çalışmam boyunca değerli katkılarını esirgemeyen eş danışmanım Prof. Dr. Wwwww Wwwwww’ye de şükranlarımı sunarım."),
    formBody("Bu çalışma boyunca yardımlarını ve desteklerini esirgemeyen sevgili aileme ve çalışma arkadaşlarıma sonsuz teşekkürlerimi sunarım."),
    formBody("Bu tez çalışması, Düzce Üniversitesi BAP-XXX-WWW numaralı Bilimsel Araştırma Projesiyle desteklenmiştir", { after: 740 }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: thesisDateTr, bold: true, size: 24 }),
        new TextRun({ text: "\t\t\t\t\t\t" }),
        new TextRun({ text: "Adı Soyadı", bold: true, size: 24 }),
      ],
    }),
    pageBreak(),
  ];
}

function contentsPage() {
  return [
    plainCenteredTitle("İÇİNDEKİLER", 260),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 260 },
      children: [new TextRun({ text: "Sayfa No", bold: true, underline: { type: UnderlineType.SINGLE }, size: 22 })],
    }),
    tocLine("ŞEKİL LİSTESİ", "vii"),
    tocLine("ÇİZELGE LİSTESİ", "viii"),
    tocLine("HARİTA LİSTESİ", "ix"),
    tocLine("KISALTMALAR", "x"),
    tocLine("SİMGELER", "xi"),
    tocLine("ÖZET", "xii"),
    tocLine("ABSTRACT", "xiii"),
    tocLine("1.     INTRODUCTION", "1"),
    tocLine("2.     LITERATURE REVIEW", "5"),
    tocLine("2.1. Cross-Cultural Public Opinion Research", "5", { left: 260, size: 21 }),
    tocLine("2.2. Online Opinion Mining and Summarization", "6", { left: 260, size: 21 }),
    tocLine("2.3. Web Security and Abuse Prevention", "7", { left: 260, size: 21 }),
    tocLine("3.     REQUIREMENTS AND SCOPE", "9"),
    tocLine("4.     MATERIALS AND METHODS", "12"),
    tocLine("5.     SYSTEM ARCHITECTURE", "16"),
    tocLine("6.     DATA MODEL AND PERSISTENCE", "21"),
    tocLine("7.     IMPLEMENTATION", "26"),
    tocLine("8.     SECURITY, PRIVACY, AND ETHICS", "34"),
    tocLine("9.     TESTING, DEPLOYMENT, AND OPERATIONS", "40"),
    tocLine("10.   RESULTS AND DISCUSSION", "44"),
    tocLine("11.   CONCLUSION AND FUTURE WORK", "49"),
    tocLine("12.   REFERENCES", "52"),
    tocLine("APPENDIX A. SCREENSHOTS", "55"),
    tocLine("APPENDIX B. API AND MODULE SUMMARY", "61"),
    pageBreak(),
  ];
}

function listFrontMatterPages() {
  return [
    plainCenteredTitle("ŞEKİL LİSTESİ", 260),
    tocLine("Şekil 5.1. WorldDeciding home screen with live question and platform metrics.", "18", { size: 20, bold: false }),
    tocLine("Şekil 6.1. Question statistics page with option, country, age, and gender breakdowns.", "24", { size: 20, bold: false }),
    tocLine("Şekil 7.1. Binary voting page with confirmation and live statistics interaction.", "28", { size: 20, bold: false }),
    tocLine("Şekil 7.2. AI-generated comment summary in the discussion panel.", "30", { size: 20, bold: false }),
    tocLine("Şekil 7.3. Country comparison screen with option split and AI insight.", "32", { size: 20, bold: false }),
    tocLine("Şekil 7.4. Administrative question management page.", "33", { size: 20, bold: false }),
    tocLine("Şekil 7.5. User profile and activity information.", "34", { size: 20, bold: false }),
    pageBreak(),
    plainCenteredTitle("ÇİZELGE LİSTESİ", 260),
    tocLine("Çizelge 4.1. Technologies used in the project.", "13", { size: 20, bold: false }),
    tocLine("Çizelge 4.2. Project risks and mitigations.", "15", { size: 20, bold: false }),
    tocLine("Çizelge 5.1. High-level architecture components.", "17", { size: 20, bold: false }),
    tocLine("Çizelge 6.1. Main entities and responsibilities.", "22", { size: 20, bold: false }),
    tocLine("Çizelge 8.1. Threat model summary.", "38", { size: 20, bold: false }),
    tocLine("Çizelge 10.1. Requirement evaluation.", "46", { size: 20, bold: false }),
    pageBreak(),
    plainCenteredTitle("HARİTA LİSTESİ", 260),
    tocLine("Harita 1. Country distribution and comparison visualization.", "32", { size: 20, bold: false }),
    pageBreak(),
  ];
}

function oralExamMinutesPageEn() {
  const rows = [
    new TableRow({
      children: [
        minutesCell("BM401 COMPUTER ENGINEERING PROJECT DESIGN / BM498\nGRADUATION THESIS\nEVALUATION AND ORAL EXAM MINUTES", {
          columnSpan: 3,
          bold: true,
          size: 22,
          alignment: AlignmentType.CENTER,
          line: 240,
        }),
      ],
    }),
    new TableRow({ children: [minutesCell("STUDENTS (NUMBER / NAME-SURNAME):", { columnSpan: 3, size: 18 })] }),
    new TableRow({ children: [minutesCell("SUPERVISOR:", { columnSpan: 3, size: 18 })] }),
    new TableRow({
      children: [
        minutesCell("Evaluation Criterion", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 76 }),
        minutesCell("Score\nRange", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 12 }),
        minutesCell("Score", { shading: "D9D9D9", bold: true, alignment: AlignmentType.CENTER, width: 12 }),
      ],
    }),
    new TableRow({ children: [minutesCell("Written Work Format Evaluation (10 Points)", { columnSpan: 3, shading: "D9D9D9", bold: true })] }),
    ...[
      ["Is the study prepared according to the thesis/project writing guide?", "0-10"],
      ["Is the problem definition clearly stated?", "0-5"],
      ["Is the literature review sufficient, current, and systematic?", "0-5"],
      ["Is the architecture of the software/hardware explained with a block diagram or data flow diagram?", "0-5"],
      ["Are the materials and method explained at a sufficient level?", "0-5"],
      ["Are the project datasets managed according to FAIR principles?", "0-5"],
      ["Are design and implementation issues discussed with solution methods?", "0-5"],
      ["What is the difficulty level of the completed work?", "0-5"],
      ["Was the presentation successful?", "0-8"],
      ["Was the student competent in answering questions?", "0-7"],
      ["Did the student prepare the required progress reports regularly?", "0-10"],
    ].map(([criterion, range]) =>
      new TableRow({
        children: [
          minutesCell(criterion, { size: 17 }),
          minutesCell(range, { size: 17, alignment: AlignmentType.CENTER }),
          minutesCell("", { size: 17 }),
        ],
      })
    ),
    new TableRow({ children: [minutesCell("Ethics and Professional Responsibility (15 Points)", { columnSpan: 3, shading: "D9D9D9", bold: true })] }),
    ...[
      ["Is the project ethically appropriate? (Plagiarism declaration, ethical declaration, data and generative AI use, human data use, Helsinki Declaration, etc.)\n☐ Plagiarism declaration exists. ☐ References follow the required citation style. ☐ Ethics approval / consent exists if human data is used. ☐ Helsinki Declaration principles are considered.", "0-5"],
      ["Did the project show awareness of engineering ethics and professional responsibility?", "0-5"],
      ["Were national/international standards such as ISO 9001, ISO 17025, or IEEE mentioned and applied where relevant?", "0-5"],
      ["Were project management, risk management, and change management approaches applied? (Work plan, task distribution, risk analysis)", "0-4"],
      ["Was the entrepreneurship and innovation dimension evaluated? (Original solution, added value, commercial potential)", "0-4"],
      ["Was the sustainable development perspective considered? (Environmental, economic, and social sustainability)", "0-4"],
      ["Was the reproducibility principle in sustainable software development applied?", "0-3"],
    ].map(([criterion, range]) =>
      new TableRow({
        children: [
          minutesCell(criterion, { size: 17 }),
          minutesCell(range, { size: 17, alignment: AlignmentType.CENTER }),
          minutesCell("", { size: 17 }),
        ],
      })
    ),
    new TableRow({
      children: [
        minutesCell("Total", { shading: "D9D9D9", bold: true }),
        minutesCell("0-100", { shading: "D9D9D9", alignment: AlignmentType.CENTER }),
        minutesCell("", { shading: "D9D9D9" }),
      ],
    }),
  ];

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
      },
      rows,
    }),
    pageBreak(),
  ];
}

function declarationPageEn() {
  return [
    formTitle("DECLARATION", 820),
    formBody(
      "I declare that this thesis is my own work; that I have not acted against academic and ethical principles at any stage from planning to writing; that I obtained all information in this thesis in accordance with academic and ethical rules; that I cited all information and interpretations not produced by this thesis and included those sources in the reference list; and that I did not violate any patent or copyright during the preparation and writing of this thesis.",
      { before: 120, after: 920 }
    ),
    rightFormText("April 3, 2026", { after: 220 }),
    rightFormText("(Signature)", { after: 120 }),
    rightFormText("(Student Name Surname)", { after: 80 }),
    pageBreak(),
  ];
}

function generativeAiDeclarationPageEn() {
  return [
    formTitle("GENERATIVE ARTIFICIAL INTELLIGENCE USE DECLARATION", 620),
    rightFormText("April 3, 2026", { before: 240, after: 360, bold: true }),
    formBody(
      "I declare that, while preparing this thesis, I did / did not receive support from generative artificial intelligence tools such as ChatGPT, Gemini, DALL-E, etc. During the preparation of my thesis, I used generative artificial intelligence tools for support such as language editing and access to scientific information. I confirm that I checked the accuracy of the information received from generative artificial intelligence tools.",
      { after: 220 }
    ),
    formBody(
      "If any statement contrary to this declaration is detected at any time, I accept all moral and legal consequences that may arise.",
      { after: 760 }
    ),
    rightFormText("(Signature)", { after: 260 }),
    rightFormText("(Student Name Surname)", { after: 80 }),
    pageBreak(),
  ];
}

function acknowledgementsPageEn() {
  return [
    formTitle("ACKNOWLEDGEMENTS", 560),
    formBody("I would like to express my sincere gratitude to my valuable supervisor Prof. Dr. Xxxxx Xxxxx for all support and guidance during my undergraduate education and the preparation of this thesis."),
    formBody("I also thank my co-supervisor Prof. Dr. Wwwww Wwwwww for valuable contributions throughout the thesis study."),
    formBody("I extend my deepest thanks to my family and colleagues for their continuous help and support during this work."),
    formBody("This thesis study was supported by Duzce University Scientific Research Project BAP-XXX-WWW.", { after: 740 }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: "April 3, 2026", bold: true, size: 24 }),
        new TextRun({ text: "\t\t\t\t\t\t" }),
        new TextRun({ text: "Name Surname", bold: true, size: 24 }),
      ],
    }),
    pageBreak(),
  ];
}

function contentsPageEn() {
  return [
    plainCenteredTitle("TABLE OF CONTENTS", 260),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 260 },
      children: [new TextRun({ text: "Page No", bold: true, underline: { type: UnderlineType.SINGLE }, size: 22 })],
    }),
    tocLine("LIST OF FIGURES", "vii"),
    tocLine("LIST OF TABLES", "viii"),
    tocLine("LIST OF MAPS", "ix"),
    tocLine("ABBREVIATIONS", "x"),
    tocLine("SYMBOLS", "xi"),
    tocLine("SUMMARY", "xii"),
    tocLine("ABSTRACT", "xiii"),
    tocLine("1.     INTRODUCTION", "1"),
    tocLine("2.     LITERATURE REVIEW", "5"),
    tocLine("2.1. Cross-Cultural Public Opinion Research", "5", { left: 260, size: 21 }),
    tocLine("2.2. Online Opinion Mining and Summarization", "6", { left: 260, size: 21 }),
    tocLine("2.3. Web Security and Abuse Prevention", "7", { left: 260, size: 21 }),
    tocLine("3.     REQUIREMENTS AND SCOPE", "9"),
    tocLine("4.     MATERIALS AND METHODS", "12"),
    tocLine("5.     SYSTEM ARCHITECTURE", "16"),
    tocLine("6.     DATA MODEL AND PERSISTENCE", "21"),
    tocLine("7.     IMPLEMENTATION", "26"),
    tocLine("8.     SECURITY, PRIVACY, AND ETHICS", "34"),
    tocLine("9.     TESTING, DEPLOYMENT, AND OPERATIONS", "40"),
    tocLine("10.   RESULTS AND DISCUSSION", "44"),
    tocLine("11.   CONCLUSION AND FUTURE WORK", "49"),
    tocLine("12.   REFERENCES", "52"),
    tocLine("APPENDIX A. SCREENSHOTS", "55"),
    tocLine("APPENDIX B. API AND MODULE SUMMARY", "61"),
    pageBreak(),
  ];
}

function listFrontMatterPagesEn() {
  return [
    plainCenteredTitle("LIST OF FIGURES", 260),
    tocLine("Figure 5.1. WorldDeciding home screen with live question and platform metrics.", "18", { size: 20, bold: false }),
    tocLine("Figure 6.1. Question statistics page with option, country, age, and gender breakdowns.", "24", { size: 20, bold: false }),
    tocLine("Figure 7.1. Binary voting page with confirmation and live statistics interaction.", "28", { size: 20, bold: false }),
    tocLine("Figure 7.2. AI-generated comment summary in the discussion panel.", "30", { size: 20, bold: false }),
    tocLine("Figure 7.3. Country comparison screen with option split and AI insight.", "32", { size: 20, bold: false }),
    tocLine("Figure 7.4. Administrative question management page.", "33", { size: 20, bold: false }),
    tocLine("Figure 7.5. User profile and activity information.", "34", { size: 20, bold: false }),
    pageBreak(),
    plainCenteredTitle("LIST OF TABLES", 260),
    tocLine("Table 4.1. Technologies used in the project.", "13", { size: 20, bold: false }),
    tocLine("Table 4.2. Project risks and mitigations.", "15", { size: 20, bold: false }),
    tocLine("Table 5.1. High-level architecture components.", "17", { size: 20, bold: false }),
    tocLine("Table 6.1. Main entities and responsibilities.", "22", { size: 20, bold: false }),
    tocLine("Table 8.1. Threat model summary.", "38", { size: 20, bold: false }),
    tocLine("Table 10.1. Requirement evaluation.", "46", { size: 20, bold: false }),
    pageBreak(),
    plainCenteredTitle("LIST OF MAPS", 260),
    tocLine("Map 1. Country distribution and comparison visualization.", "32", { size: 20, bold: false }),
    pageBreak(),
  ];
}

function screenshotParagraph(name, caption, width = 520) {
  const file = imgPath(name);
  const size = pngSize(file);
  const height = Math.round((width * size.height) / size.width);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 80 },
      children: [
        new ImageRun({
          data: fs.readFileSync(file),
          transformation: { width, height },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 20 })],
    }),
  ];
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function sectionTitlePage() {
  return [
    new Paragraph({ spacing: { before: 1800, after: 240 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DUZCE UNIVERSITY", bold: true, size: 30 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Faculty of Engineering", size: 26 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Department of Computer Engineering", size: 26 })],
      spacing: { after: 640 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: 34, color: "000000" })],
      spacing: { after: 480, line: 420 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Undergraduate Thesis / Graduation Project", size: 26 })],
      spacing: { after: 520 },
    }),
    docText("Prepared by: [Student Name Surname]", { alignment: AlignmentType.CENTER, size: 24, after: 100 }),
    docText("Student No: [Student Number]", { alignment: AlignmentType.CENTER, size: 24, after: 100 }),
    docText("Supervisor: [Academic Title, Name Surname]", { alignment: AlignmentType.CENTER, size: 24, after: 100 }),
    docText(`Project: ${projectName}`, { alignment: AlignmentType.CENTER, size: 24, after: 520 }),
    docText(`Duzce, ${generatedDate}`, { alignment: AlignmentType.CENTER, size: 22, after: 100 }),
    pageBreak(),
  ];
}

const thesisParagraphs = [
  ...sectionTitlePage(),
  ...oralExamMinutesPageEn(),
  ...declarationPageEn(),
  ...generativeAiDeclarationPageEn(),
  ...acknowledgementsPageEn(),
  ...contentsPageEn(),
  ...listFrontMatterPagesEn(),
  heading("ABBREVIATIONS"),
  table(
    ["Abbreviation", "Meaning"],
    [
      ["API", "Application Programming Interface"],
      ["CQRS", "Command Query Responsibility Segregation"],
      ["DTO", "Data Transfer Object"],
      ["EF Core", "Entity Framework Core"],
      ["GA4", "Google Analytics 4"],
      ["GeoIP", "IP-based geographic inference"],
      ["JWT", "JSON Web Token"],
      ["ORM", "Object Relational Mapper"],
      ["RBAC", "Role-Based Access Control"],
      ["SPA", "Single Page Application"],
      ["TTL", "Time To Live"],
    ],
    [25, 75]
  ),
  pageBreak(),
  heading("SYMBOLS"),
  docText(
    "No special mathematical symbols are used in this thesis. The software architecture, data model, and system behavior are explained through text, tables, and figures."
  ),
  pageBreak(),
  heading("SUMMARY"),
  docText(
    "This thesis presents the design and development of WorldDeciding, a web platform built to collect, compare, and visualize user opinions on controversial topics whose responses may differ across cultural contexts. The platform includes registration, login, email verification, voting, commenting, category-based discovery, country-based comparison, demographic statistics, leaderboard views, an administrator panel, spam protection, and AI-assisted summarization."
  ),
  docText(
    "The system is developed with .NET 8 ASP.NET Core Web API, a React and TypeScript frontend, PostgreSQL, Redis caching and rate limiting, Docker-based deployment, and Gemini AI integration. The backend follows a layered architecture composed of Domain, Application, Infrastructure, and API projects. Security controls include ASP.NET Core Identity, JWT access tokens, HttpOnly refresh token cookies, role-based authorization, IP hashing, CORS restrictions, security headers, and Redis-backed abuse counters."
  ),
  docText(
    "As a result, the study presents an interactive, extensible, and privacy-aware web platform prototype for cross-cultural opinion analysis. The platform does not claim scientific survey representativeness; its results should be interpreted as platform participation data. Future work should strengthen sampling balance, minimum display thresholds, moderation workflows, automated test coverage, and production security processes."
  ),
  docText("Keywords: cross-cultural opinion analysis, web platform, public opinion, .NET Web API, React, PostgreSQL, Redis, data privacy, rate limiting, statistical visualization."),
  pageBreak(),
  heading("ABSTRACT"),
  docText(
    "This thesis presents the design and development of WorldDeciding, a web platform for collecting, comparing, and visualizing public opinions on controversial and culturally sensitive topics. The core purpose of the platform is to let authenticated users vote on questions, participate in comments, and inspect the resulting opinion distribution through statistical views such as option breakdowns, country-level comparison, gender and age-band summaries, leaderboards, and AI-assisted discussion summaries. The system is implemented as a modern full-stack web application with a .NET 8 ASP.NET Core Web API backend, a React and TypeScript frontend, PostgreSQL for persistent relational data, Redis for cache and abuse counters, and Docker-based deployment support."
  ),
  docText(
    "The backend follows a layered architecture shaped around Domain, Application, Infrastructure, and API projects. CQRS-style request handlers are implemented with MediatR, validation is implemented with FluentValidation, persistence is implemented with Entity Framework Core and Npgsql, and authentication relies on ASP.NET Core Identity, JWT access tokens, and rotating refresh tokens stored in HttpOnly cookies. The platform includes security and privacy controls such as password rules, email confirmation, role-based administration, IP hashing, country inference without raw IP persistence, CORS allowlisting, security headers, Redis-backed rate limiting, and analytics consent. The frontend provides a responsive user experience for registration, login, question exploration, voting, comments, AI summaries, statistics, country comparison, profile pages, categories, leaderboards, and administrative question management."
  ),
  docText(
    "The study demonstrates how a web platform can combine opinion collection, cross-cultural comparison, privacy-aware data handling, and operational safeguards in one practical system. The final discussion evaluates the implementation against functional requirements and identifies future work, including improved sampling controls, moderation workflows, minimum-threshold privacy suppression, expanded automated tests, and stronger production secret governance."
  ),
  docText("Keywords: cross-cultural opinion analysis, web platform, public opinion, .NET Web API, React, PostgreSQL, Redis, data privacy, rate limiting, statistical visualization."),
  pageBreak(),
  heading("1. Introduction"),
  heading("1.1 Problem Definition", HeadingLevel.HEADING_2),
  docText(
    "Public opinion is increasingly expressed through digital platforms, but many ordinary polling interfaces only show global totals and do not explain how views differ across countries, age groups, genders, or discussion communities. For controversial topics, a simple total can hide important cross-cultural patterns. A question may appear balanced globally while one country strongly prefers one option, another country prefers a different option, and a third group has insufficient sample size to support interpretation."
  ),
  docText(
    "WorldDeciding addresses this problem by collecting structured votes and comments and then presenting the results through comparative statistics. The application is not a replacement for a scientific national survey, because it does not use controlled sampling or weighting. Instead, it is a web platform prototype that demonstrates how opinion collection, country comparison, and privacy-aware implementation can be combined in an interactive public system."
  ),
  heading("1.2 Aim of the Project", HeadingLevel.HEADING_2),
  docText(
    "The aim of this thesis is to design and implement a web platform that enables users to express opinions on controversial topics, compare the results across countries and demographic dimensions, and discuss the topics through moderated interaction mechanisms. The engineering goal is to produce a maintainable, containerized, security-conscious, and extensible full-stack system."
  ),
  heading("1.3 Contributions", HeadingLevel.HEADING_2),
  bullet("A layered .NET and React implementation for cross-cultural opinion collection."),
  bullet("Country-aware voting and comparison using declared or inferred country codes."),
  bullet("Statistical screens for option, country, gender, age-band, view, and vote metrics."),
  bullet("Redis-backed anti-abuse mechanisms for login, password reset, voting, and views."),
  bullet("AI-assisted summarization for comments and tentative country comparison insight."),
  bullet("Administrative tools for categories, question lifecycle, and bulk import."),
  bullet("Privacy features including IP hashing, consent handling, analytics control, and security headers."),
  heading("1.4 Thesis Organization", HeadingLevel.HEADING_2),
  docText(
    "The remainder of the thesis reviews related work, defines the project requirements, explains the selected technologies and architecture, describes the data model and implementation, discusses security and ethics, presents results from the developed prototype, and concludes with limitations and future work."
  ),
  pageBreak(),
  heading("2. Literature Review"),
  heading("2.1 Cross-Cultural Public Opinion Research", HeadingLevel.HEADING_2),
  docText(
    "Cross-cultural opinion analysis has a long tradition in social science. Large programs such as the World Values Survey investigate social, political, economic, religious, and cultural values across countries and waves of data collection [1]. These projects show that values and attitudes are not only individual properties but also form patterns that can vary by national and cultural context. The European Social Survey similarly emphasizes that measuring attitudes cross-nationally requires methodological rigor, because language, sampling, measurement equivalence, and country context affect comparability [2]."
  ),
  docText(
    "WorldDeciding borrows the motivation of comparative attitude research but adapts it to a web engineering context. Instead of long questionnaire waves with representative samples, the platform supports short controversial questions, fast participation, and interactive visualization. This makes the system useful as a prototype for exploratory opinion signals, but it also requires careful labeling so users understand that the results are platform samples rather than nationally representative estimates."
  ),
  heading("2.2 Online Opinion Mining and Summarization", HeadingLevel.HEADING_2),
  docText(
    "Opinion mining and sentiment analysis research studies the computational treatment of opinion, sentiment, subjectivity, and evaluative text [3]. Pang and Lee argue that the growth of opinion-rich online resources created both opportunities and challenges for systems that help people understand what others think. WorldDeciding uses a structured voting model for quantitative signals and a comment model for qualitative discussion. The AI summarization component is not used to decide the result; it is used to condense discussion or provide tentative explanatory language for country comparison."
  ),
  heading("2.3 Web Security and Abuse Prevention", HeadingLevel.HEADING_2),
  docText(
    "A public voting platform is exposed to fake accounts, repeated voting attempts, credential stuffing, automated scraping, and view inflation. ASP.NET Core Identity provides configurable password, lockout, token, claims, and cookie options that support secure authentication workflows [4]. Redis documentation defines rate limiting as a technique for controlling request rates to preserve stability, security, and fair usage [5]. OWASP ASVS provides a broad verification framework for authentication, session management, access control, validation, cryptography, API security, and configuration review [7]. These references inform the security controls and recommendations in this project."
  ),
  heading("2.4 Gap Addressed by the Project", HeadingLevel.HEADING_2),
  docText(
    "Existing large surveys provide rigor but are slow and institutionally heavy, while many web polls provide speed but weak identity, privacy, and cross-country analysis. WorldDeciding sits between these categories: it is an engineering prototype that demonstrates fast opinion collection with country-aware comparison, user discussion, and practical security safeguards. Its research value is in the design and implementation of a full platform rather than in proving a new statistical theory."
  ),
  heading("2.5 Design Lessons Taken from the Literature", HeadingLevel.HEADING_2),
  docText(
    "The reviewed literature leads to four design lessons. First, the system should expose sample size and context instead of presenting percentages alone, because cross-national interpretation is weak when the number of observations is small. Second, country labels should be treated as metadata with a known source, not as absolute truth. Third, structured votes and free-text comments should be handled separately: votes are useful for measurable distributions, while comments help explain why users may have selected an option. Fourth, the platform should explicitly separate exploratory platform data from representative public opinion research. These lessons shaped the statistics UI, the country comparison DTOs, and the AI prompts that use tentative wording."
  ),
  docText(
    "The project also reflects an engineering lesson from security literature: voting accuracy is not only a statistical problem. If authentication, session management, rate limiting, and duplicate prevention are weak, the resulting data can be manipulated before statistical analysis begins. For this reason, abuse prevention is treated as part of the opinion analysis pipeline."
  ),
  pageBreak(),
  heading("3. Requirements and Scope"),
  heading("3.1 Functional Requirements", HeadingLevel.HEADING_2),
  ...[
    "Users shall be able to register with email, password, country, birth date, and gender.",
    "The platform shall confirm email accounts and support password reset through email.",
    "Authenticated users shall be able to vote on published binary or multi-option questions.",
    "Each authenticated user shall have one active vote per question, with a cooldown before changing the vote.",
    "The system shall record view counts while avoiding repeated daily counting from the same hashed IP.",
    "The system shall show question statistics by option, country, gender, and age band.",
    "Users shall be able to compare two countries for a question and see option splits against the global baseline.",
    "Authenticated users shall be able to add comments, replies, and likes.",
    "The platform shall produce AI-assisted summaries for comments and country comparison insight.",
    "Administrators shall manage categories, questions, publishing, archiving, and bulk imports.",
    "The frontend shall include pages for home, questions, detail, statistics, categories, leaderboard, profile, login, registration, privacy, and cookies.",
  ].map((x) => numbered(x)),
  heading("3.2 Non-Functional Requirements", HeadingLevel.HEADING_2),
  bullet("Security: enforce authentication, role checks, token validation, anti-abuse counters, and secure cookie settings."),
  bullet("Privacy: avoid storing raw IP addresses, limit analytics until consent, and make country inference transparent."),
  bullet("Maintainability: separate domain, application, infrastructure, and API concerns."),
  bullet("Performance: cache frequently requested statistics and aggregate daily counters for leaderboards."),
  bullet("Deployability: support Dockerized PostgreSQL, Redis, API, frontend, pgAdmin, and RedisInsight services."),
  bullet("Usability: provide a responsive interface with clear flows for voting, comments, comparison, and administration."),
  heading("3.3 Scope Boundaries", HeadingLevel.HEADING_2),
  docText(
    "The project implements a working web platform prototype. It does not claim representative polling accuracy, automated content moderation, formal psychometric validation, or complete legal compliance for every jurisdiction. These items are discussed as future work and operational requirements before public-scale deployment."
  ),
  pageBreak(),
  heading("4. Materials and Methods"),
  heading("4.1 Technologies Used", HeadingLevel.HEADING_2),
  table(
    ["Layer", "Technology", "Purpose"],
    [
      ["Frontend", "React 18, TypeScript, Vite", "Single page application and client-side routing"],
      ["Frontend state/data", "React Query, Zustand, Axios", "Server state, auth state, API calls, token refresh"],
      ["UI and visuals", "Tailwind CSS, Three.js, OGL", "Responsive screens, globe/stat scenes, visual presentation"],
      ["Backend", ".NET 8, ASP.NET Core Web API", "REST API, middleware, controllers, hosting"],
      ["Application", "MediatR, FluentValidation, AutoMapper", "CQRS-style handlers, validation, DTO mapping"],
      ["Identity", "ASP.NET Core Identity, JWT", "Users, roles, password rules, access tokens"],
      ["Persistence", "PostgreSQL 16, EF Core, Npgsql", "Relational data and migrations [6]"],
      ["Cache and rate limit", "Redis 7, StackExchange.Redis", "Stats cache, live question cache, abuse counters"],
      ["AI", "Gemini API client", "Comment and country comparison summaries"],
      ["Operations", "Docker Compose, Nginx, Serilog", "Container orchestration, static frontend serving, logging"],
    ],
    [18, 32, 50]
  ),
  heading("4.2 Development Method", HeadingLevel.HEADING_2),
  docText(
    "The implementation was reviewed from the repository structure and source files. Backend responsibilities are separated into Domain, Application, Infrastructure, and API projects. Frontend responsibilities are separated into pages, entities, features, components, widgets, shared API helpers, and application providers. The method used in this thesis is constructive software development: requirements were mapped to modules, modules were implemented, and the result was documented through code inspection, screenshots, and build verification."
  ),
  heading("4.3 Data Collection Model", HeadingLevel.HEADING_2),
  docText(
    "The platform collects platform-native opinion data: question votes, country codes, user demographic fields, comments, likes, view events, and profile metadata. No raw IP address is persisted in the vote or view entities. IP addresses are used transiently to calculate salted SHA-256 hashes for uniqueness and abuse prevention. Country codes are stored as ISO-3166-1 alpha-2 strings when available. The data model can support FAIR-oriented management through explicit schema, migrations, timestamps, controlled import format, and documented entity semantics."
  ),
  heading("4.4 Project Management Method", HeadingLevel.HEADING_2),
  docText(
    "The project was managed as an incremental engineering implementation. The first increment focused on the core data model and authentication. The second increment added question listing, voting, statistics, and country metadata. The third increment added comments, AI summaries, profile and leaderboard behavior. The fourth increment added administration, Docker deployment, privacy consent, and documentation. This sequence reduced risk because the most central data flow, authenticated voting, was implemented before secondary features."
  ),
  table(
    ["Risk", "Impact", "Mitigation"],
    [
      ["Duplicate or automated voting", "Distorted statistics", "Authenticated votes, unique database index, Redis vote-attempt counter, vote cooldown."],
      ["Wrong country attribution", "Misleading country comparison", "Declared and inferred country source metadata, confidence field, registration country check."],
      ["Sensitive opinion exposure", "Privacy and ethics risk", "No raw IP storage, consent pages, future threshold suppression recommendation."],
      ["AI overclaiming", "Misleading explanations", "Prompt instructs tentative language and fallback text when data or provider is unavailable."],
      ["Operational secret leakage", "Account or infrastructure compromise", "Production env vars already supported; recommendation to remove all secrets from appsettings."],
      ["Low automated test coverage", "Regression risk", "Focused future test plan for vote, auth, comments, admin, and abuse flows."],
    ],
    [26, 31, 43]
  ),
  heading("4.5 Reproducibility Method", HeadingLevel.HEADING_2),
  docText(
    "Reproducibility is supported through source-controlled projects, EF Core migrations, seed data for initial categories and sample questions, Dockerfiles for the API and frontend, and Docker Compose definitions for PostgreSQL and Redis. A future academic submission should include exact commit hash, environment variables template, database migration command, and a test dataset description. The generated documentation in this folder is also reproducible through the generate-deliverables.mjs script."
  ),
  pageBreak(),
  heading("5. System Architecture"),
  heading("5.1 Architectural Style", HeadingLevel.HEADING_2),
  docText(
    "WorldDeciding uses a layered architecture close to Clean Architecture. The Domain project contains entities and identity models. The Application project contains commands, queries, DTOs, interfaces, validators, and business rules. The Infrastructure project implements persistence, security, caching, email, GeoIP, AI, and reader services. The Web API project wires dependency injection, authentication, authorization, CORS, middleware, Swagger, and controllers."
  ),
  docText(
    "Most business actions are expressed as MediatR commands or queries. Controllers are thin and delegate behavior to handlers. This separation makes it easier to test application rules independently from HTTP details and allows infrastructure implementations to be replaced through interfaces."
  ),
  heading("5.2 High-Level Architecture", HeadingLevel.HEADING_2),
  table(
    ["Component", "Responsibility"],
    [
      ["React SPA", "Renders user journeys, calls REST endpoints, stores access token in memory, refreshes tokens through cookie endpoint."],
      ["ASP.NET Core API", "Exposes authentication, voting, questions, comments, categories, profile, leaderboard, privacy, live question, and admin endpoints."],
      ["Application handlers", "Apply use-case rules such as vote cooldown, stats query aggregation, country comparison, comment summary, and imports."],
      ["PostgreSQL", "Stores users, roles, questions, options, votes, comments, categories, refresh tokens, views, summaries, and daily stats."],
      ["Redis", "Stores short-lived counters and cached data for abuse prevention, rate limiting, live question behavior, and stats caching."],
      ["Gemini", "Provides optional summarization for comments and country comparison insight, with fallback text if unavailable."],
      ["Docker Compose", "Runs PostgreSQL, Redis, API, pgAdmin, RedisInsight, and supports environment-based production configuration."],
    ],
    [28, 72]
  ),
  heading("5.3 Request Flow", HeadingLevel.HEADING_2),
  bullet("A user opens the React SPA and browses questions, categories, or the live question."),
  bullet("For protected actions, the frontend attaches a JWT access token through the Axios interceptor."),
  bullet("If the access token expires, the frontend calls the refresh endpoint with the HttpOnly refresh cookie."),
  bullet("The API validates the JWT issuer, audience, signing key, and role claims."),
  bullet("A controller sends a command or query to MediatR."),
  bullet("The handler reads/writes PostgreSQL through IAppDbContext and uses Redis, GeoIP, or AI services when required."),
  bullet("The API returns DTOs to the frontend, which updates React Query caches and screen state."),
  ...screenshotParagraph(screenshots.home1, "Figure 5.1. WorldDeciding home screen with live question and platform metrics."),
  heading("5.4 Backend Middleware and Dependency Injection", HeadingLevel.HEADING_2),
  docText(
    "Program.cs is the composition root of the backend. It configures Serilog request logging, EF Core with PostgreSQL, Identity, JWT bearer authentication, Redis multiplexer, distributed Redis cache, CORS, FluentValidation, MediatR, AutoMapper, Swagger, security headers, forwarded headers, and the custom rate-limit exception middleware. The API also seeds roles, categories, and starter questions at startup through EnsureSeededAsync. This startup structure makes the runtime dependencies explicit and allows environment-specific configuration through appsettings, user secrets, or Docker environment variables."
  ),
  docText(
    "The middleware order is significant. Forwarded headers must be read before authentication and IP-based logic so that reverse proxy deployments can identify the real client address. The rate-limit exception middleware is placed before controller execution so application-level TooManyRequestsException values can be converted into HTTP 429 responses. CORS, authentication, and authorization are applied before controllers are mapped."
  ),
  heading("5.5 Frontend Architecture", HeadingLevel.HEADING_2),
  docText(
    "The frontend is a Vite React application written in TypeScript. Its structure follows a practical feature-oriented organization: pages define route-level views, entities define reusable domain APIs and types, features implement task-specific logic such as voting or admin APIs, shared contains API and UI utilities, widgets contain larger shared UI sections such as the navbar, and app contains providers for cookies and analytics. React Query is used for server-state fetching and invalidation, while Zustand stores authentication state."
  ),
  docText(
    "The Axios client stores the access token in memory and attaches it to outgoing API requests. If a protected API call receives 401, the interceptor calls the refresh endpoint once and queues other failed requests until a new access token is available. This approach avoids storing the access token in localStorage while still preserving user sessions through the refresh cookie."
  ),
  pageBreak(),
  heading("6. Data Model and Persistence"),
  heading("6.1 Main Entities", HeadingLevel.HEADING_2),
  table(
    ["Entity", "Main Fields", "Role in the System"],
    [
      ["AppUser", "Id, Email, CountryCode, BirthDate, Gender, DisplayName, Bio, AvatarUrl, Score", "Identity and profile data for authenticated users."],
      ["Question", "Id, Title, Type, Status, CategoryId, Language, TagsJson, Source", "Voting prompt managed by administrators."],
      ["Option", "Id, QuestionId, Text", "Selectable answer for binary or multi-option questions."],
      ["Vote", "QuestionId, OptionId, UserId, CountryCode, CountrySource, CountryProvider, CountryConfidence, IpHash", "Opinion record used for statistics and country comparison."],
      ["Comment", "QuestionId, UserId, ParentId, Text, CreatedAt, LikeCount", "Threaded discussion data."],
      ["CommentLike", "CommentId, UserId", "Prevents duplicate likes and supports like toggling."],
      ["Category", "Slug, Name", "Question organization."],
      ["RefreshToken", "TokenHash, FamilyId, CreatedAt, ExpiresAt, RevokedAt, ReplacedByTokenHash", "Rotating refresh session state."],
      ["QuestionView", "QuestionId, UserId, IpHash, ViewDate", "Daily unique view tracking."],
      ["QuestionStatsDaily", "QuestionId, Date, Views, Votes", "Pre-aggregated counters for dashboards and leaderboards."],
      ["QuestionCommentSummary", "QuestionId, SummaryText, GeneratedAt, IsStale, Model", "Cached AI summary for a question's discussion."],
    ],
    [19, 36, 45]
  ),
  heading("6.2 Database Constraints and Indexes", HeadingLevel.HEADING_2),
  docText(
    "The EF Core model defines important integrity constraints. Options are unique by question and text. Votes have a unique index on QuestionId and UserId, which enforces one active vote per user per question. Country comparison is optimized by indexes on QuestionId, CountryCode, and OptionId. Question views use unique indexes for daily deduplication by user or hashed IP. Comments are indexed for question, parent, like count, and creation time to support sorting and threaded replies."
  ),
  heading("6.3 Aggregation Strategy", HeadingLevel.HEADING_2),
  docText(
    "Daily view and vote counters are maintained in QuestionStatsDaily through PostgreSQL upsert statements. This design reduces repeated expensive aggregation for leaderboards and allows time-window queries such as 24 hours, 7 days, 30 days, and all-time. Detailed question statistics are still computed from votes and user demographics when needed, and short-lived Redis cache entries reduce repeated work."
  ),
  ...screenshotParagraph(screenshots.stats1, "Figure 6.1. Question statistics page with option, country, age, and gender breakdowns."),
  heading("6.4 Data Lifecycle and FAIR Considerations", HeadingLevel.HEADING_2),
  docText(
    "Findability is supported by stable GUID identifiers, category slugs, question titles, status flags, and timestamps. Accessibility is supported through REST endpoints and admin screens, although production access should remain role-controlled. Interoperability is supported through ISO-style country codes, JSON DTOs, EF Core migrations, and clear separation between data entities and view models. Reusability is supported by explicit schema design and seed data, but a public research dataset would require additional metadata, anonymization policy, consent records, and export documentation."
  ),
  docText(
    "The data lifecycle begins with administrator-created or imported questions. Users then create votes and comments. Vote events update daily counters and invalidate caches. Comment creation marks the AI summary as stale. Statistics can be served from live aggregation or cache depending on endpoint. For long-term research use, retention schedules should define when raw comments, account data, logs, and derived aggregates are archived or deleted."
  ),
  pageBreak(),
  heading("7. Implementation"),
  heading("7.1 Authentication and Account Flow", HeadingLevel.HEADING_2),
  docText(
    "The AuthController implements registration, email confirmation, login, password reset, token refresh, logout, country detection for registration, and resend confirmation. Password policy is configured in Program.cs with length, digit, uppercase, lowercase, and non-alphanumeric requirements. Accounts must be email-confirmed before login. Access tokens are short-lived JWTs, while refresh tokens are random opaque values stored as hashes in the database and delivered through an HttpOnly cookie."
  ),
  heading("7.2 Voting Flow", HeadingLevel.HEADING_2),
  docText(
    "The CastVoteHandler validates that the selected option belongs to the question, resolves the authenticated user ID from claims, hashes the client IP, resolves country information, checks Redis-backed abuse limits, and inserts or updates the vote. A new vote increases the user's score and increments daily vote statistics. If a user tries to change a vote too soon, the handler enforces a 24-hour cooldown. This rule prevents rapid vote manipulation while still allowing users to revise an opinion later."
  ),
  ...screenshotParagraph(screenshots.eitherOr, "Figure 7.1. Binary voting page with confirmation and live statistics interaction."),
  heading("7.3 Comment and AI Summary Flow", HeadingLevel.HEADING_2),
  docText(
    "Comments are protected actions. Users can add root comments, add replies, and toggle likes. Comment text is trimmed and limited to 2000 characters. When a new comment is added, the associated QuestionCommentSummary is marked stale. The summary handler gathers recent and top-liked comments, applies a short user-level Redis rate limit, calls the AI summarizer, and stores the result with generation metadata."
  ),
  ...screenshotParagraph(screenshots.aiSummary, "Figure 7.2. AI-generated comment summary in the discussion panel.", 360),
  heading("7.4 Country Comparison Flow", HeadingLevel.HEADING_2),
  docText(
    "Country comparison receives two ISO country codes and aggregates vote counts by country and option. It also calculates a global baseline. The frontend visualizes option-by-option differences, top options, overlap score, sample sizes, global distance, and AI-generated tentative explanations. The implementation intentionally uses cautious language and fallback text when the AI provider is unavailable."
  ),
  ...screenshotParagraph(screenshots.countryCompare, "Figure 7.3. Country comparison screen with option split and AI insight."),
  heading("7.5 Administration Flow", HeadingLevel.HEADING_2),
  docText(
    "Administrators can create, list, publish, archive, inspect, and bulk import questions. Bulk import validates question length, options, category slug, language, source, and duplicate title-language combinations. Categories can also be created, updated, and deleted by users with the Admin role. This workflow supports controlled content generation and avoids exposing question creation to untrusted users."
  ),
  ...screenshotParagraph(screenshots.adminQuestions, "Figure 7.4. Administrative question management page."),
  heading("7.6 Live Question and Leaderboard", HeadingLevel.HEADING_2),
  docText(
    "The live question service exposes a current question and a statistics endpoint. The home page polls these endpoints to show the current live prompt and its vote distribution. The leaderboard uses QuestionStatsDaily and raw SQL through Npgsql to rank questions by views or votes over time windows such as 24 hours, 7 days, 30 days, or all time. This combination supports both immediate engagement and broader trend discovery."
  ),
  heading("7.7 Profile and Gamification", HeadingLevel.HEADING_2),
  docText(
    "The profile module lets users manage display name, biography, avatar URL, country, birth date, and gender. Public profiles expose selected activity metadata. The score service adds points for first-time votes, and badge resolvers classify users into simple achievement categories such as First Vote, Contributor, Popular, and Active. This gamification layer encourages participation but should be monitored so it does not incentivize low-quality or spam behavior."
  ),
  ...screenshotParagraph(screenshots.profile, "Figure 7.5. User profile and activity information."),
  heading("7.8 Privacy and Analytics Implementation", HeadingLevel.HEADING_2),
  docText(
    "The privacy controller stores a lightweight consent DTO in the wd_consent cookie. The frontend reads this state through CookieConsentProvider and only enables GA4 tracking when analytics consent is true. Page-view events are sent manually after consent rather than automatically on initial load. This design keeps optional analytics disabled by default and makes the consent state visible to the application."
  ),
  pageBreak(),
  heading("8. Security, Privacy, and Ethics"),
  heading("8.1 Implemented Security Controls", HeadingLevel.HEADING_2),
  bullet("ASP.NET Core Identity password policy and lockout configuration."),
  bullet("Email confirmation before login and password reset through email token links."),
  bullet("JWT issuer, audience, signing key, and short access-token lifetime validation."),
  bullet("Rotating refresh tokens with database hashes, token family IDs, revocation, and reuse detection."),
  bullet("HttpOnly refresh cookie with environment-specific Secure and SameSite settings."),
  bullet("Role-based authorization for administrative endpoints."),
  bullet("CORS configured from an allowlist and credentials enabled only for trusted frontend origins."),
  bullet("Security headers for content type sniffing, framing, referrer policy, and permissions policy."),
  bullet("Redis counters for login attempts, forgot-password requests, vote attempts, view attempts, and AI summary requests."),
  bullet("Unique database indexes for one vote per user per question and daily unique views."),
  heading("8.2 Privacy Controls", HeadingLevel.HEADING_2),
  docText(
    "The code avoids storing raw IP addresses in vote and view records. Instead, it stores salted SHA-256 hashes for deduplication and abuse control. Country information is stored as a short code with source metadata, provider metadata, and confidence. The frontend includes optional analytics consent, and GA4 tracking is only enabled after consent. Analytics is configured with IP anonymization."
  ),
  heading("8.3 Ethical Considerations", HeadingLevel.HEADING_2),
  docText(
    "The platform processes personal and opinion data, which can reveal sensitive cultural, political, or social preferences. A production deployment should present clear informed consent, explain country inference, provide privacy notices, allow data deletion requests where legally required, and avoid displaying small-country or small-demographic groups in a way that could expose individuals. The current implementation includes 13+ age validation and privacy-aware IP hashing, but final deployment should include a formal ethics review if real human-subject data is used for academic research."
  ),
  heading("8.4 Security Gaps and Recommendations", HeadingLevel.HEADING_2),
  bullet("Move all secrets, including SMTP credentials and API keys, out of appsettings files and into user secrets, environment variables, or a secret manager."),
  bullet("Add rate limits for comment creation, reply creation, and like toggling to reduce discussion spam."),
  bullet("Add CSRF protection or double-submit checks for cookie-backed refresh and other credentialed cookie flows where applicable."),
  bullet("Apply minimum sample thresholds or suppression to country and demographic comparison before showing small groups."),
  bullet("Add content reporting, moderation queues, and audit logs for controversial discussion management."),
  bullet("Introduce dependency scanning, container scanning, and OWASP ASVS-based security checklist review [7]."),
  bullet("Increase automated test coverage for vote uniqueness, refresh-token reuse, country mismatch, abuse limits, and admin imports."),
  heading("8.5 Threat Model Summary", HeadingLevel.HEADING_2),
  table(
    ["Threat", "Current Control", "Residual Risk"],
    [
      ["Credential stuffing", "Identity lockout settings and Redis login attempt counter.", "Distributed attacks may require device fingerprinting, CAPTCHA, or external WAF controls."],
      ["Vote manipulation", "Authentication, unique vote index, cooldown, Redis vote-attempt limit.", "Coordinated fake accounts can still distort results."],
      ["View inflation", "Daily unique hashed IP view record and Redis silent drop.", "NAT/shared networks and distributed botnets can reduce accuracy."],
      ["Country spoofing", "GeoIP, declared country, confidence metadata, registration check.", "VPN/proxy users can still be misclassified or blocked incorrectly."],
      ["Comment spam", "Authentication and text length validation.", "Dedicated comment rate limits and moderation are still required."],
      ["Refresh token theft", "HttpOnly cookie, token hashing, rotation, reuse family revocation.", "Device compromise or cookie theft still requires anomaly monitoring."],
      ["Sensitive group exposure", "Raw IP is not stored.", "Small-country and demographic threshold suppression is not yet implemented."],
      ["AI misuse", "Prompt asks for neutral and tentative summaries, fallback text.", "Prompt injection and summary bias need evaluation and moderation controls."],
    ],
    [24, 39, 37]
  ),
  pageBreak(),
  heading("9. Testing, Deployment, and Operations"),
  heading("9.1 Current Test Status", HeadingLevel.HEADING_2),
  docText(
    "The repository contains a unit test project, but the current test file is only a placeholder. Therefore, the strongest verification presently comes from build checks and code inspection. For a thesis defense, the project should include focused unit and integration tests around the most important business rules."
  ),
  heading("9.2 Recommended Test Plan", HeadingLevel.HEADING_2),
  table(
    ["Area", "Example Tests"],
    [
      ["Authentication", "Register validation, email confirmation, login failure, login success, password reset, refresh rotation, refresh reuse revocation."],
      ["Voting", "Option-question mismatch, one vote per user, vote change cooldown, country assignment, cache invalidation, stats increments."],
      ["Statistics", "Option percentages, country grouping, gender and age-band grouping, zero-vote behavior."],
      ["Comments", "Length validation, parent validation, reply listing, like toggle, stale summary flag."],
      ["Abuse", "Redis threshold behavior for login, forgot-password, vote, view, and AI summary requests."],
      ["Admin", "Bulk import validation, duplicate detection, publish/archive transitions, category CRUD."],
      ["Frontend", "Protected routes, token refresh interceptor, consent flow, vote confirmation, country compare modal."],
    ],
    [25, 75]
  ),
  heading("9.3 Deployment Model", HeadingLevel.HEADING_2),
  docText(
    "The docker-compose.yml file defines PostgreSQL 16, Redis 7, the API, pgAdmin, and RedisInsight. The frontend Dockerfile builds the React application with Node 20 and serves the generated static files through Nginx. The API Dockerfile publishes the .NET 8 application and exposes port 8080. Production settings are injected through environment variables, including database connection string, JWT key, refresh token pepper, IP salt, Gemini key, and CORS origins [8]."
  ),
  heading("9.4 Operational Checklist", HeadingLevel.HEADING_2),
  bullet("Run database migrations before serving traffic and verify seed data completes successfully."),
  bullet("Use strong production values for JWT key, refresh token pepper, IP salt, database password, SMTP password, and Gemini API key."),
  bullet("Configure CORS origins to exact production frontend domains only."),
  bullet("Terminate TLS at a reverse proxy and preserve X-Forwarded-For and X-Forwarded-Proto headers safely."),
  bullet("Monitor API 401, 403, 409, 429, and 5xx responses to detect authentication, abuse, and reliability issues."),
  bullet("Back up PostgreSQL volumes and test restore procedures."),
  bullet("Limit access to pgAdmin and RedisInsight to trusted networks or disable them in production."),
  bullet("Enable dependency and container image scanning in the CI/CD pipeline."),
  pageBreak(),
  heading("10. Results and Discussion"),
  heading("10.1 Implemented User Experience", HeadingLevel.HEADING_2),
  docText(
    "The screenshots show that WorldDeciding has a complete interaction flow: a live home page, question discovery, binary voting, statistics visualization, country comparison, comments, profiles, categories, leaderboards, login, registration, and administration. The application is not merely a static prototype; the UI maps directly to API endpoints and data models in the repository."
  ),
  ...screenshotParagraph(screenshots.questions, "Figure 10.1. Question listing page."),
  ...screenshotParagraph(screenshots.leaderboard, "Figure 10.2. Leaderboard page."),
  heading("10.2 Engineering Evaluation", HeadingLevel.HEADING_2),
  docText(
    "The implementation demonstrates appropriate separation of concerns for a graduation project. Controllers remain mostly thin, use cases are concentrated in handlers, infrastructure services hide implementation details, and frontend modules follow page/entity/feature/shared boundaries. PostgreSQL provides relational consistency for identity, votes, comments, and stats. Redis supports fast, expiring counters and cached responses. Docker Compose supports reproducible local and production-like deployment."
  ),
  heading("10.3 Limitations", HeadingLevel.HEADING_2),
  bullet("The system currently provides platform-sample opinion analysis, not representative survey inference."),
  bullet("Country inference can be affected by VPNs, proxies, mobile networks, and GeoIP database accuracy."),
  bullet("Small sample sizes can create misleading country or demographic comparisons if not suppressed."),
  bullet("Automated test coverage is still minimal and should be expanded before production use."),
  bullet("AI summaries can simplify or misinterpret discussion, so summaries must remain explicitly labeled as AI-generated and tentative."),
  bullet("Moderation and abuse controls should be expanded for comments, profiles, and uploads before public launch."),
  heading("10.4 Discussion", HeadingLevel.HEADING_2),
  docText(
    "The project successfully implements the major thesis goal: a web platform that collects opinions and presents cross-cultural comparison. Its strongest engineering elements are the layered backend, vote uniqueness rules, country-aware aggregation, Redis-backed rate controls, rotating refresh-token model, and polished statistics UI. Its main research limitation is sampling: without recruitment, weighting, or response-bias correction, the data should be interpreted as participation data from the platform community. This limitation is acceptable for a software engineering thesis if it is explained clearly and not overstated as scientific public opinion measurement."
  ),
  heading("10.5 Evaluation Against Requirements", HeadingLevel.HEADING_2),
  table(
    ["Requirement", "Implementation Evidence", "Status"],
    [
      ["Registration and login", "AuthController, Identity configuration, frontend login/register pages.", "Implemented"],
      ["Email confirmation and reset", "Confirm-email, resend-confirmation, forgot-password, reset-password endpoints.", "Implemented"],
      ["Authenticated voting", "VotesController and CastVoteHandler with JWT user resolution.", "Implemented"],
      ["Duplicate vote prevention", "Unique index on QuestionId and UserId, conflict handling.", "Implemented"],
      ["Country comparison", "CountryCompareHandler and statistics frontend modal.", "Implemented"],
      ["Demographic statistics", "GetQuestionStatsHandler reads user gender and birth date.", "Implemented"],
      ["Comments and likes", "CommentsController, AddCommentHandler, ToggleCommentLikeHandler.", "Implemented"],
      ["AI summaries", "GptSummarizer, GetQuestionSummaryHandler, country comparison summary.", "Implemented with provider fallback"],
      ["Spam protection", "Redis counters for login, forgot password, vote, view, and AI summary.", "Partially implemented"],
      ["Admin tools", "AdminQuestionsController and category admin endpoints.", "Implemented"],
      ["Automated tests", "Unit test project exists but contains no effective tests.", "Needs work"],
    ],
    [25, 55, 20]
  ),
  heading("10.6 Example Use Case Walk-Through", HeadingLevel.HEADING_2),
  docText(
    "A typical user lands on the home page and sees the current live question. The user opens the question, selects an option, and is asked to sign in or register if not authenticated. During registration, the user provides country and demographic fields; in production, the country can be compared against GeoIP-derived metadata. After login, the user submits a vote. The backend validates the option, checks abuse counters, stores the vote with country metadata, increments daily statistics, and invalidates cached stats. The frontend then updates the option distribution and offers navigation to the statistics page."
  ),
  docText(
    "On the statistics page, the user can inspect vote distribution by option and country. Selecting two countries opens the comparison modal. The modal displays each country's vote distribution, global baseline, biggest option gap, overlap score, and AI-generated interpretation. The user can also open the comment drawer, read the discussion, request an AI summary, post a reply, or like existing comments. Administrators manage the content supply through bulk import and publish/archive controls."
  ),
  pageBreak(),
  heading("11. Conclusion and Future Work"),
  docText(
    "This thesis documented the design and development of WorldDeciding, a full-stack web platform for cross-cultural opinion analysis. The platform supports account creation, secure login, voting, comments, country comparison, statistical dashboards, AI-assisted summaries, administration, privacy consent, and containerized deployment. The implementation shows that modern web technologies can be combined to produce an extensible system for exploring how opinions differ across cultural and geographic contexts."
  ),
  docText(
    "Future work should focus on scientific validity, operational safety, and production maturity. Scientific validity can be improved through sampling strategies, weighting, survey metadata, confidence intervals, and minimum display thresholds. Operational safety can be improved through moderation tools, report workflows, rate limits for all write actions, audit logging, and security testing. Production maturity can be improved through secret management, CI/CD, observability, backups, automated tests, and formal privacy impact assessment."
  ),
  heading("Future Work Items", HeadingLevel.HEADING_2),
  bullet("Add confidence intervals and sample-size warnings to statistics pages."),
  bullet("Introduce demographic and country threshold suppression to reduce re-identification risk."),
  bullet("Add moderation, reporting, and admin review workflows for comments and profiles."),
  bullet("Create integration tests with Testcontainers for PostgreSQL and Redis."),
  bullet("Add API versioning and OpenAPI-based client generation."),
  bullet("Improve AI governance with prompt-injection defenses and summary quality review."),
  bullet("Add data export, deletion, and consent-history workflows for privacy compliance."),
  pageBreak(),
  heading("12. References"),
  ...refs.flatMap((r) => [
    docText(`[${r.id}] ${r.text}`, { after: 40 }),
    docText(r.url, { color: "0563C1", size: 20, after: 130 }),
  ]),
  pageBreak(),
  heading("Appendix A. Screenshots"),
  ...screenshotParagraph(screenshots.register, "Figure A.1. Registration page.", 410),
  ...screenshotParagraph(screenshots.login, "Figure A.2. Login page.", 410),
  ...screenshotParagraph(screenshots.categories, "Figure A.3. Categories page."),
  ...screenshotParagraph(screenshots.profile, "Figure A.4. Authenticated profile page."),
  ...screenshotParagraph(screenshots.publicProfile, "Figure A.5. Public profile page.", 420),
  ...screenshotParagraph(screenshots.comment, "Figure A.6. Comment panel.", 360),
  ...screenshotParagraph(screenshots.countryCompare2, "Figure A.7. Country comparison detail panel."),
  ...screenshotParagraph(screenshots.bulkImport, "Figure A.8. Bulk import page."),
  ...screenshotParagraph(screenshots.adminCategories, "Figure A.9. Admin categories page."),
  ...screenshotParagraph(screenshots.ga4, "Figure A.10. GA4 analytics page used for operational review."),
  pageBreak(),
  heading("Appendix B. API and Module Summary"),
  table(
    ["Area", "Representative Endpoints"],
    [
      ["Authentication", "GET /api/auth/register-country, POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout"],
      ["Questions", "GET /api/questions, GET /api/questions/{id}, GET /api/questions/{id}/stats, POST /api/questions/{id}/view"],
      ["Voting", "POST /api/votes"],
      ["Country comparison", "GET /api/questions/{id}/country-compare?left=TR&right=US"],
      ["Comments", "GET/POST /api/questions/{id}/comments, GET /api/comments/{id}/replies, POST /api/comments/{id}/like"],
      ["Categories", "GET /api/categories, GET /api/categories/{id}/questions, admin POST/PUT/DELETE category endpoints"],
      ["Profile", "GET /api/profile/me, PUT /api/profile/me, GET /api/profile/{userId}"],
      ["Leaderboard and live", "GET /api/leaderboard, GET /api/live, GET /api/live/stats"],
      ["Admin questions", "GET /api/admin/questions, POST /api/admin/questions/bulk-import, publish/archive/detail endpoints"],
      ["Privacy", "GET /api/privacy/consent, POST /api/privacy/consent"],
    ],
    [28, 72]
  ),
];

async function makeDocx() {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "main-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Times New Roman", size: 22 },
          paragraph: { spacing: { line: 320, after: 120 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Times New Roman", size: 30, bold: true, color: "000000" },
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Times New Roman", size: 26, bold: true, color: "000000" },
          paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1417, right: 1417, bottom: 1417, left: 1985 },
          },
        },
        children: thesisParagraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  let file = path.join(outDir, "WorldDeciding_Thesis_Main.docx");
  try {
    fs.writeFileSync(file, buffer);
  } catch (error) {
    if (error?.code !== "EBUSY" && error?.code !== "EPERM") {
      throw error;
    }
    file = path.join(outDir, "WorldDeciding_Thesis_Main_Expanded.docx");
    fs.writeFileSync(file, buffer);
  }
  return file;
}

const slideW = 960;
const slideH = 540;

const themes = {
  term: {
    bg: "#F8FAFC",
    rail: "#264653",
    title: "#1F2937",
    subtitle: "#64748B",
    body: "#111827",
    accent: "#2A9D8F",
    accent2: "#E9C46A",
    panel: "#FFFFFF",
    border: "#D9E2EC",
  },
  literature: {
    bg: "#FBFAF7",
    rail: "#5F3E2F",
    title: "#3C2F2F",
    subtitle: "#6B5B52",
    body: "#2B2522",
    accent: "#8E6C88",
    accent2: "#C9A227",
    panel: "#FFFFFF",
    border: "#E3D8CC",
  },
  design: {
    bg: "#F4F9FF",
    rail: "#1F4E79",
    title: "#163B5C",
    subtitle: "#5C6F82",
    body: "#172033",
    accent: "#22A699",
    accent2: "#3BAFDA",
    panel: "#FFFFFF",
    border: "#D9E8F4",
  },
  results: {
    bg: "#F8FBF8",
    rail: "#1F6F50",
    title: "#18392B",
    subtitle: "#587064",
    body: "#17231E",
    accent: "#4C956C",
    accent2: "#D68C45",
    panel: "#FFFFFF",
    border: "#DDEBDD",
  },
  defense: {
    bg: "#F7F7FB",
    rail: "#343A5E",
    title: "#252A41",
    subtitle: "#62677A",
    body: "#171A2A",
    accent: "#6C63FF",
    accent2: "#2E8BC0",
    panel: "#FFFFFF",
    border: "#DEDFF0",
  },
};

function wrapText(doc, text, x, y, w, options = {}) {
  doc.text(text, x, y, { width: w, lineGap: options.lineGap ?? 4, align: options.align ?? "left" });
}

function activeTheme(ctxOrTheme) {
  return ctxOrTheme?.theme ?? ctxOrTheme ?? themes.design;
}

function slideBackground(doc, section = "", theme = themes.design) {
  doc.rect(0, 0, slideW, slideH).fill(theme.bg);
  doc.rect(0, 0, 9, slideH).fill(theme.rail);
  doc.rect(28, 27, 118, 3).fill(theme.accent);
  doc.circle(slideW - 82, 62, 88).fillOpacity(0.08).fill(theme.accent2).fillOpacity(1);
  doc.roundedRect(slideW - 258, slideH - 88, 210, 34, 16).fillOpacity(0.09).fill(theme.accent).fillOpacity(1);
  doc.font("Helvetica").fontSize(9).fillColor(theme.subtitle).text(section, 34, slideH - 28, { width: 520 });
  doc.fontSize(9).text(`${projectName} | ${generatedDate}`, slideW - 230, slideH - 28, { width: 200, align: "right" });
}

function drawTitle(doc, titleText, subtitle = "", theme = themes.design, y = 44) {
  doc.font("Helvetica-Bold").fontSize(29).fillColor(theme.title).text(titleText, 52, y, { width: 770, lineGap: 3 });
  if (subtitle) {
    doc.font("Helvetica").fontSize(13.5).fillColor(theme.subtitle).text(subtitle, 54, y + 62, { width: 760, lineGap: 4 });
  }
}

function drawBullets(doc, bullets, x = 64, y = 154, w = 550, size = 17, theme = themes.design) {
  let cy = y;
  doc.font("Helvetica").fontSize(size).fillColor(theme.body);
  for (const b of bullets) {
    doc.circle(x, cy + 7, 3.1).fill(theme.accent);
    doc.fillColor(theme.body).text(b, x + 16, cy, { width: w, lineGap: 4 });
    cy += Math.max(34, Math.ceil(doc.heightOfString(b, { width: w, lineGap: 4 }) + 15));
  }
}

function drawNumberedBullets(doc, bullets, x = 64, y = 154, w = 760, size = 16, theme = themes.design) {
  let cy = y;
  bullets.forEach((b, index) => {
    doc.circle(x + 10, cy + 9, 11).fill(theme.accent);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text(String(index + 1), x + 6, cy + 3, { width: 8, align: "center" });
    doc.font("Helvetica").fontSize(size).fillColor(theme.body).text(b, x + 34, cy, { width: w, lineGap: 4 });
    cy += Math.max(38, Math.ceil(doc.heightOfString(b, { width: w, lineGap: 4 }) + 17));
  });
}

function drawPanel(doc, x, y, w, h, theme = themes.design, radius = 8) {
  doc.roundedRect(x, y, w, h, radius).fill(theme.panel);
  doc.roundedRect(x, y, w, h, radius).strokeColor(theme.border).lineWidth(1).stroke();
}

function drawImage(doc, fileName, x, y, w, h, theme = themes.design) {
  const full = imgPath(fileName);
  doc.roundedRect(x - 6, y - 6, w + 12, h + 12, 8).fill("#FFFFFF");
  doc.roundedRect(x - 6, y - 6, w + 12, h + 12, 8).strokeColor(theme.border).lineWidth(1).stroke();
  doc.image(full, x, y, { fit: [w, h], align: "center", valign: "center" });
}

function drawMetricCards(doc, cards, x = 52, y = 150, theme = themes.design) {
  const cardW = Math.floor((856 - (cards.length - 1) * 20) / cards.length);
  const gap = 22;
  cards.forEach((card, i) => {
    const cx = x + i * (cardW + gap);
    drawPanel(doc, cx, y, cardW, 130, theme);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(theme.rail).text(card.label, cx + 18, y + 18, { width: cardW - 36 });
    doc.font("Helvetica-Bold").fontSize(27).fillColor(theme.title).text(card.value, cx + 18, y + 52, { width: cardW - 36 });
    doc.font("Helvetica").fontSize(10.5).fillColor(theme.subtitle).text(card.note, cx + 18, y + 92, { width: cardW - 36, lineGap: 2 });
  });
}

function makeDeck(fileName, deckTitle, slides, theme = themes.design) {
  const file = path.join(outDir, fileName);
  const doc = new PDFDocument({ size: [slideW, slideH], margin: 0, autoFirstPage: false, info: { Title: deckTitle } });
  doc.pipe(fs.createWriteStream(file));
  slides.forEach((slide, index) => {
    doc.addPage();
    slideBackground(doc, `${deckTitle} | Slide ${index + 1}/${slides.length}`, theme);
    slide(doc, { deckTitle, index, total: slides.length, theme });
  });
  doc.end();
  return file;
}

function coverSlide(deckTitle, subtitle) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    doc.rect(0, 0, slideW, slideH).fill(theme.rail);
    doc.rect(52, 58, 132, 5).fill(theme.accent2);
    doc.circle(780, 80, 160).fillOpacity(0.13).fill(theme.accent2).fillOpacity(1);
    doc.circle(150, 500, 220).fillOpacity(0.11).fill(theme.accent).fillOpacity(1);
    doc.font("Helvetica-Bold").fontSize(40).fillColor("#FFFFFF").text(projectName, 58, 80);
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#FFFFFF").text(deckTitle, 58, 150, { width: 760, lineGap: 4 });
    doc.font("Helvetica").fontSize(18).fillColor("#D7EAF6").text(subtitle, 60, 266, { width: 760, lineGap: 6 });
    doc.font("Helvetica").fontSize(13).fillColor("#A9C7D9").text(title, 60, 430, { width: 780 });
    doc.fontSize(12).text(`Prepared by: [Student Name] | ${generatedDate}`, 60, 468);
  };
}

function sectionSlide(slideTitle, bullets, img = null, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    drawBullets(doc, bullets, 64, opts.subtitle ? 144 : 132, img ? 470 : 790, opts.size ?? 16.5, theme);
    if (img) drawImage(doc, img, 570, 136, 330, 250, theme);
  };
}

function agendaSlide(items, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, opts.title ?? "Agenda", opts.subtitle ?? "", theme);
    drawNumberedBullets(doc, items, 70, opts.subtitle ? 150 : 136, 750, 17, theme);
  };
}

function twoColumnSlide(slideTitle, leftTitle, leftBullets, rightTitle, rightBullets, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    const y = opts.subtitle ? 150 : 134;
    drawPanel(doc, 58, y, 400, 310, theme);
    drawPanel(doc, 502, y, 400, 310, theme);
    doc.font("Helvetica-Bold").fontSize(17).fillColor(theme.rail).text(leftTitle, 82, y + 22, { width: 340 });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(theme.rail).text(rightTitle, 526, y + 22, { width: 340 });
    drawBullets(doc, leftBullets, 84, y + 64, 330, 14.5, theme);
    drawBullets(doc, rightBullets, 528, y + 64, 330, 14.5, theme);
  };
}

function matrixSlide(slideTitle, headers, rows, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    const x = 56;
    const y = opts.subtitle ? 150 : 136;
    const tableW = 848;
    const colW = tableW / headers.length;
    const rowH = opts.rowH ?? 56;
    headers.forEach((h, i) => {
      doc.rect(x + i * colW, y, colW, 42).fill(i % 2 === 0 ? theme.rail : theme.accent);
      doc.font("Helvetica-Bold").fontSize(12.5).fillColor("#FFFFFF").text(h, x + i * colW + 10, y + 13, { width: colW - 20 });
    });
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const cx = x + c * colW;
        const cy = y + 42 + r * rowH;
        doc.rect(cx, cy, colW, rowH).fill(r % 2 === 0 ? "#FFFFFF" : "#F4F7FA");
        doc.rect(cx, cy, colW, rowH).strokeColor(theme.border).lineWidth(0.7).stroke();
        doc.font(c === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(10.8).fillColor(theme.body).text(cell, cx + 10, cy + 11, { width: colW - 20, lineGap: 2 });
      });
    });
  };
}

function processSlide(slideTitle, steps, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    const y = opts.subtitle ? 164 : 148;
    const startX = 64;
    const gap = 18;
    const boxW = Math.floor((828 - gap * (steps.length - 1)) / steps.length);
    steps.forEach((step, i) => {
      const x = startX + i * (boxW + gap);
      drawPanel(doc, x, y, boxW, 205, theme);
      doc.circle(x + 26, y + 30, 16).fill(i % 2 === 0 ? theme.accent : theme.accent2);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF").text(String(i + 1), x + 21, y + 22, { width: 10, align: "center" });
      doc.font("Helvetica-Bold").fontSize(14).fillColor(theme.title).text(step.title, x + 18, y + 62, { width: boxW - 36, lineGap: 2 });
      doc.font("Helvetica").fontSize(11.2).fillColor(theme.body).text(step.text, x + 18, y + 104, { width: boxW - 36, lineGap: 3 });
      if (i < steps.length - 1) {
        doc.moveTo(x + boxW + 4, y + 102).lineTo(x + boxW + gap - 4, y + 102).strokeColor(theme.accent).lineWidth(1.2).stroke();
      }
    });
  };
}

function highlightSlide(slideTitle, statement, bullets, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    doc.roundedRect(70, 142, 820, 104, 8).fill(theme.rail);
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#FFFFFF").text(statement, 98, 171, { width: 764, lineGap: 4, align: "center" });
    drawBullets(doc, bullets, 96, 286, 740, 16, theme);
  };
}

function imageSlide(slideTitle, bullets, image, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    const y = opts.subtitle ? 150 : 134;
    drawBullets(doc, bullets, 58, y, 330, 14.3, theme);
    drawImage(doc, image, 430, y, 450, 285, theme);
  };
}

function imageGridSlide(slideTitle, images, labels, opts = {}) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, opts.subtitle ?? "", theme);
    const y = opts.subtitle ? 146 : 130;
    images.forEach((image, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 70 + col * 425;
      const yy = y + row * 170;
      drawImage(doc, image, x, yy, 350, 118, theme);
      doc.font("Helvetica-Bold").fontSize(11.5).fillColor(theme.rail).text(labels[index], x, yy + 126, { width: 350, align: "center" });
    });
  };
}

function referenceSlide(slideTitle, items) {
  return (doc, ctx) => {
    const theme = activeTheme(ctx);
    drawTitle(doc, slideTitle, "", theme);
    let y = 130;
    items.forEach((item, i) => {
      doc.font("Helvetica-Bold").fontSize(12).fillColor(theme.rail).text(`[${i + 1}]`, 64, y, { width: 36 });
      doc.font("Helvetica").fontSize(11.5).fillColor(theme.body).text(item, 102, y, { width: 760, lineGap: 2 });
      y += Math.max(44, doc.heightOfString(item, { width: 760, lineGap: 2 }) + 16);
    });
  };
}

function createPresentations() {
  const termStart = makeDeck("01_Term_Start_Presentation.pdf", "Term Start Presentation", [
    coverSlide("Term Start Presentation", "Project motivation, problem definition, proposed scope, and initial plan."),
    agendaSlide([
      "Problem context and motivation",
      "Target users and expected value",
      "Initial scope and out-of-scope boundaries",
      "Planned architecture, data, security, and timeline",
      "Risks, assumptions, and success criteria",
    ]),
    sectionSlide("Problem", [
      "Online polls often show only global totals and hide cultural differences.",
      "Large scientific surveys are rigorous but slow and not interactive.",
      "Controversial topics need transparent statistics, discussion, and abuse protection.",
      "The project explores a practical middle ground: fast web participation with country-aware comparison.",
    ]),
    highlightSlide("Motivation", "Opinion platforms need context, not only totals.", [
      "A 51 percent result can mean very different things when countries, age bands, and discussion context are visible.",
      "A web prototype can make comparative thinking easier, even when it cannot replace scientific sampling.",
      "The engineering challenge is to combine participation, analysis, security, and privacy in one coherent flow.",
    ]),
    sectionSlide("Project Aim", [
      "Build a web platform where users vote on controversial questions.",
      "Display option, country, age, and gender distributions.",
      "Support country-to-country comparison for the same question.",
      "Allow comments, replies, likes, profiles, categories, and leaderboards.",
    ]),
    sectionSlide("Initial User Roles", [
      "Visitor: browse public questions, categories, leaderboards, and stats.",
      "Registered user: vote, comment, like, manage profile, and view AI summaries.",
      "Administrator: create categories, import questions, publish, archive, and inspect content.",
    ]),
    twoColumnSlide("Scope Boundaries", "Included in the Thesis Prototype", [
      "Question browsing and authenticated voting",
      "Country, age, gender, and option statistics",
      "Comments, replies, likes, and AI summary",
      "Admin question and category management",
    ], "Deferred Beyond the Prototype", [
      "Representative national sampling",
      "Payment, advertising, or public API monetization",
      "Full moderation operations center",
      "Native mobile applications",
    ]),
    sectionSlide("Planned Technology Stack", [
      ".NET 8 ASP.NET Core Web API for backend services.",
      "React, TypeScript, Vite, React Query, and Tailwind CSS for frontend.",
      "PostgreSQL for relational data and Redis for cache/rate limiting.",
      "Docker Compose for local and production-like deployment.",
      "Gemini integration for AI-assisted summaries.",
    ]),
    processSlide("Expected Architecture", [
      { title: "Frontend", text: "React pages and shared UI call the API through typed client modules." },
      { title: "API", text: "Controllers expose authenticated and public endpoints with middleware controls." },
      { title: "Application", text: "Commands and queries hold the platform use cases and validation rules." },
      { title: "Infrastructure", text: "EF Core, Redis, email, GeoIP, token, and AI services implement integrations." },
    ]),
    matrixSlide("Initial Requirement Map", ["Requirement", "Why It Matters", "Expected Evidence"], [
      ["Authenticated voting", "Limits duplicate participation and supports profile-based analysis.", "Vote flow, token validation, cooldown checks"],
      ["Country comparison", "Makes cross-cultural differences visible.", "Country pair modal and global baseline"],
      ["Abuse protection", "Protects quality of vote and comment signals.", "Redis counters and request limits"],
      ["Documentation", "Supports academic review and reproducibility.", "Thesis, slides, guide, install PDF"],
    ]),
    sectionSlide("Initial Risks", [
      "Country inference can be inaccurate for VPN/proxy traffic.",
      "Self-selected users do not produce representative survey samples.",
      "Spam and repeated actions can distort vote and comment signals.",
      "Opinion data can be sensitive and requires privacy-aware design.",
    ]),
    processSlide("Project Plan", [
      { title: "Phase 1", text: "Authentication, question model, category model, and basic vote flow." },
      { title: "Phase 2", text: "Statistics, country comparison, comments, replies, and profiles." },
      { title: "Phase 3", text: "Admin tools, Redis limits, AI summaries, privacy pages, and consent." },
      { title: "Phase 4", text: "Docker deployment, final documentation, verification, and demo preparation." },
    ]),
    sectionSlide("Success Criteria", [
      "A user can register, log in, vote, inspect statistics, and participate in discussion.",
      "An administrator can create, import, publish, archive, and organize questions.",
      "The system avoids raw IP storage and separates analytics consent from core usage.",
      "The final documentation explains installation, usage, design, limitations, and license information.",
    ]),
  ], themes.term);

  const literature = makeDeck("02_Literature_Review_Presentation.pdf", "Literature Review", [
    coverSlide("Literature Review", "Cross-cultural opinion research, online opinion mining, and secure web platform foundations."),
    agendaSlide([
      "Cross-cultural survey foundations",
      "Limits of web-based opinion collection",
      "Opinion mining and discussion summarization",
      "Security, privacy, and deployment references",
      "Literature-informed requirements for WorldDeciding",
    ]),
    sectionSlide("Cross-Cultural Surveys", [
      "The World Values Survey studies beliefs and values across countries and time.",
      "The European Social Survey emphasizes rigorous cross-national attitude measurement.",
      "These projects show why country context matters when interpreting opinion data.",
      "WorldDeciding adapts this motivation to an interactive web prototype.",
    ]),
    twoColumnSlide("Survey Tradition vs. Web Prototype", "Survey Tradition", [
      "Controlled sampling strategy",
      "Validated questionnaires",
      "Slow but methodologically strong publication cycle",
      "Careful cross-national comparability",
    ], "WorldDeciding Prototype", [
      "Self-selected platform participation",
      "Fast public interaction and feedback",
      "Exploratory comparison, not national estimation",
      "Engineering focus on visibility, controls, and usability",
    ]),
    sectionSlide("Methodological Challenge", [
      "Cross-national comparison is affected by sampling, language, measurement equivalence, and context.",
      "A web platform cannot claim representative national estimates without controlled sampling.",
      "Therefore, WorldDeciding labels results as platform participation signals.",
      "Future work should add sample-size warnings, weighting, and confidence intervals.",
    ]),
    matrixSlide("Threats to Interpretation", ["Threat", "Effect", "Design Response"], [
      ["Self-selection", "Participants may not represent a population.", "Use cautious labels and avoid national claims."],
      ["Small samples", "Percentages can swing after a few votes.", "Add thresholds and warnings in future work."],
      ["GeoIP uncertainty", "Country metadata may be wrong.", "Store country confidence and explain limitations."],
      ["Language/context", "Question meaning may shift across cultures.", "Future multilingual review is required."],
    ]),
    sectionSlide("Opinion Mining", [
      "Opinion mining treats opinions and subjective text as first-class analysis objects.",
      "WorldDeciding combines structured votes with qualitative comments.",
      "AI summaries condense discussion but do not determine the vote result.",
      "Summaries must stay neutral, tentative, and explicitly AI-generated.",
    ]),
    sectionSlide("Security Literature", [
      "ASP.NET Core Identity supports configurable password and lockout policies.",
      "Redis rate limiting protects stability and helps reduce abusive traffic.",
      "OWASP ASVS provides a checklist for authentication, sessions, access control, validation, cryptography, APIs, and configuration.",
      "These references map directly to platform safeguards.",
    ]),
    twoColumnSlide("Privacy Design Implications", "Data Needed", [
      "User account identity for voting rules",
      "Country metadata for comparison",
      "Demographic fields for optional breakdowns",
      "Comment text for discussion summaries",
    ], "Data to Minimize", [
      "Raw IP addresses should not be stored.",
      "Analytics must depend on explicit consent.",
      "Refresh tokens should be rotated and revocable.",
      "AI prompts should contain only the needed discussion context.",
    ]),
    sectionSlide("Related Platform Gap", [
      "Survey systems are rigorous but less interactive.",
      "Social platforms are interactive but often noisy, manipulative, and hard to interpret statistically.",
      "Simple poll apps rarely include privacy-aware country comparison or abuse controls.",
      "WorldDeciding focuses on engineering a responsible comparison platform.",
    ]),
    sectionSlide("Implications for Design", [
      "Use authenticated voting to reduce duplicate participation.",
      "Store country metadata and confidence to make comparisons explainable.",
      "Avoid raw IP persistence and use salted hashes for deduplication.",
      "Add thresholds and warnings for small groups in future versions.",
    ]),
    sectionSlide("Literature-Informed Requirements", [
      "Comparative statistics must be visible and understandable.",
      "The system must distinguish exploratory signals from representative survey results.",
      "Privacy and abuse controls are part of the core design, not optional additions.",
      "AI outputs must use cautious explanatory language.",
    ]),
    referenceSlide("Key References", [
      "World Values Survey: cross-national value research and comparative social measurement.",
      "European Social Survey: methodology for rigorous cross-national attitude surveys.",
      "Pang and Lee: opinion mining and sentiment analysis as a research area.",
      "Microsoft Identity, Redis rate limiting, OWASP ASVS, Npgsql, and Docker Compose documentation.",
    ]),
  ], themes.literature);

  const design = makeDeck("03_Design_and_Development_Presentation.pdf", "Design and Development", [
    coverSlide("Design and Development Presentation", "Architecture, data model, implementation modules, and user interface."),
    agendaSlide([
      "Layered solution structure",
      "Backend API modules and domain model",
      "Voting, statistics, and country comparison implementation",
      "Frontend experience and admin workflow",
      "Security, privacy, and deployment design",
    ]),
    sectionSlide("Implemented Architecture", [
      "Backend is split into Domain, Application, Infrastructure, and API projects.",
      "MediatR handlers implement command and query use cases.",
      "Infrastructure services implement EF Core, Redis, GeoIP, email, tokens, and AI.",
      "React frontend is organized by pages, entities, features, widgets, and shared modules.",
    ]),
    processSlide("Request Flow", [
      { title: "React UI", text: "Pages and feature modules collect user input and call typed API helpers." },
      { title: "Controller", text: "ASP.NET Core endpoints validate route context, authorization, and request shape." },
      { title: "Handler", text: "Application commands and queries coordinate business rules and DTOs." },
      { title: "Services", text: "Infrastructure implements database, cache, email, GeoIP, token, and AI work." },
    ]),
    sectionSlide("Backend API Modules", [
      "Auth: register, login, email confirmation, reset password, refresh token, logout.",
      "Questions: list, detail, stats, view recording, AI discussion summary.",
      "Votes: authenticated vote submission and cooldown handling.",
      "Comments: list, create, replies, likes.",
      "Admin: categories, question lifecycle, bulk import, analytics support.",
    ]),
    sectionSlide("Data Model", [
      "Question and Option represent the voting prompt.",
      "Vote stores user, option, country metadata, confidence, and hashed IP.",
      "QuestionStatsDaily stores pre-aggregated daily vote/view counters.",
      "Comment, CommentLike, and QuestionCommentSummary support discussion and AI summaries.",
      "RefreshToken supports rotating token families and reuse detection.",
    ]),
    matrixSlide("Layer Responsibilities", ["Layer", "Responsibility", "Example Files"], [
      ["Domain", "Entity definitions and identity models.", "Question, Option, Vote, Comment, AppUser"],
      ["Application", "Commands, queries, DTOs, validators, interfaces.", "CastVoteHandler, ListQuestionsHandler"],
      ["Infrastructure", "Persistence and external service implementations.", "DbContext, Redis, GeoIP, AI, email"],
      ["API", "HTTP endpoints, middleware, auth policies, CORS.", "Controllers, Program.cs, rate middleware"],
    ]),
    imageSlide("Development: Voting Implementation", [
      "Validates option-question relationship.",
      "Extracts authenticated user ID from JWT claims.",
      "Hashes client IP before persistence.",
      "Uses Redis abuse checks for rapid vote attempts.",
      "Enforces one active vote per user and a 24-hour change cooldown.",
    ], screenshots.eitherOr),
    imageSlide("Development: Statistics Implementation", [
      "Aggregates option counts and percentages.",
      "Groups votes by country for geographic analysis.",
      "Reads user demographics for gender and age-band breakdowns.",
      "Caches detailed stats briefly and maintains daily counters for leaderboards.",
    ], screenshots.stats1),
    imageSlide("Development: Country Comparison", [
      "Compares two selected ISO country codes.",
      "Shows country totals, option splits, global baseline, biggest gap, overlap score, and closest-to-global signal.",
      "Adds AI-generated tentative explanation with fallback text.",
      "Future improvement: suppress small samples by threshold.",
    ], screenshots.countryCompare),
    imageSlide("Development: Frontend Experience", [
      "Home page shows live question, totals, categories, and trending questions.",
      "Question detail supports voting, comments, AI summaries, and navigation.",
      "Statistics page uses interactive country selection and visual breakdowns.",
      "Profile, leaderboard, category, login, register, privacy, and cookie pages complete the app flow.",
    ], screenshots.questions),
    imageSlide("Development: Admin Experience", [
      "Admin dashboard centralizes content management.",
      "Question list filters by status, language, and search.",
      "Bulk import validates category, text length, options, language, and duplicates.",
      "Publish and archive endpoints manage the question lifecycle.",
    ], screenshots.bulkImport),
    twoColumnSlide("Security and Privacy Design", "Security Controls", [
      "JWT validation and refresh token rotation",
      "Email confirmation before login",
      "Role-based admin authorization",
      "Redis-backed rate and abuse counters",
    ], "Privacy Controls", [
      "Salted IP hash instead of raw IP persistence",
      "Consent-based analytics activation",
      "Country confidence metadata",
      "Privacy and cookie pages in the frontend",
    ]),
    processSlide("Deployment Design", [
      { title: "PostgreSQL", text: "Durable relational store with EF Core migrations." },
      { title: "Redis", text: "Cache and rate limiting for high-frequency actions." },
      { title: "API", text: "ASP.NET Core container exposes the production HTTP service." },
      { title: "Frontend", text: "Vite build is served by the web hosting layer." },
    ]),
  ], themes.design);

  const results = makeDeck("04_Results_and_Demo_Presentation.pdf", "Results and Demo", [
    coverSlide("Results and Demo Presentation", "Implemented screens, flows, and observed engineering outcomes."),
    agendaSlide([
      "Implemented scope",
      "Public and authenticated user flows",
      "Statistics and comparison demo",
      "Discussion, profile, and admin demo",
      "Engineering outcomes and remaining gaps",
    ]),
    (doc) => {
      const theme = themes.results;
      drawTitle(doc, "Implemented Scope", "The prototype covers the main user, admin, analytics, and privacy flows.", theme);
      drawMetricCards(doc, [
        { label: "Backend", value: "4 layers", note: "Domain, Application, Infrastructure, API" },
        { label: "Core entities", value: "11+", note: "Questions, votes, comments, users, stats, tokens" },
        { label: "Deliverables", value: "9 files", note: "Thesis, 5 slides, guide, install PDF, license TXT" },
      ], 52, 150, theme);
    },
    imageSlide("Home and Discovery Demo", [
      "Live question panel updates periodically.",
      "Quick links move users to questions, categories, and leaderboard.",
      "Public browsing works before authentication.",
      "Voting requires registration or login.",
    ], screenshots.home2),
    imageSlide("Registration and Login Demo", [
      "Registration captures email, password, country, birth date, and gender.",
      "Email confirmation is required before login.",
      "Access tokens stay in memory; refresh token is in an HttpOnly cookie.",
      "Axios interceptor automatically refreshes expired access tokens.",
    ], screenshots.register),
    imageSlide("Vote and Stats Demo", [
      "User selects an option and confirms vote submission.",
      "Vote result updates the question statistics.",
      "Option percentages animate on the frontend.",
      "The stats page exposes views, votes, countries, age, and gender.",
    ], screenshots.stats2),
    imageSlide("Country Compare Demo", [
      "User selects two countries from the country list.",
      "The modal compares country totals and option splits.",
      "Global baseline helps users interpret whether a country is close to or far from the overall pattern.",
      "AI insight provides cautious narrative context.",
    ], screenshots.countryCompare2),
    imageSlide("Discussion Demo", [
      "Authenticated users post comments and replies.",
      "Users can sort by top or new, like comments, and load replies.",
      "AI summary condenses recent and top-liked comments.",
      "Summary generation is rate limited.",
    ], screenshots.comment),
    imageGridSlide("Completed Interface Evidence", [
      screenshots.categories,
      screenshots.leaderboard,
      screenshots.profile,
      screenshots.adminQuestions,
    ], [
      "Category discovery",
      "Leaderboard",
      "Profile management",
      "Admin question review",
    ]),
    imageSlide("Admin Demo", [
      "Admins review question lists and status.",
      "Bulk import supports structured question creation.",
      "Categories are managed separately.",
      "Role-based authorization protects admin endpoints.",
    ], screenshots.adminPanel),
    twoColumnSlide("Operational Results", "What Works", [
      "End-to-end voting and statistics flow",
      "Admin content lifecycle",
      "AI summary integration with fallback behavior",
      "Dockerized database and cache services",
    ], "What Needs More Work", [
      "Automated integration tests",
      "Moderation and reporting queues",
      "Sample-size suppression",
      "Production monitoring and backup routines",
    ]),
    sectionSlide("Results", [
      "The platform implements the requested opinion collection and comparison workflow.",
      "The architecture is maintainable enough for continued development.",
      "Security and privacy controls are present in core flows.",
      "The main remaining gaps are sampling validity, moderation, threshold suppression, and automated tests.",
    ]),
    sectionSlide("Demo Script", [
      "Start with public browsing: home, question list, categories, and leaderboard.",
      "Register or log in, cast a vote, and open statistics for the same question.",
      "Compare two countries, then open comments and AI summary.",
      "Switch to admin account, review questions, import new questions, and publish content.",
    ]),
  ], themes.results);

  const finalDefense = makeDeck("05_Final_Defense_Presentation.pdf", "Final Defense Presentation", [
    coverSlide("Final Defense Presentation", "Thesis summary, architecture, implementation, evaluation, limitations, and future work."),
    agendaSlide([
      "Problem and objective",
      "System design and implementation",
      "Security, privacy, and evaluation",
      "Limitations and future work",
      "Final contribution",
    ]),
    sectionSlide("Thesis Problem", [
      "People express opinions online, but simple totals hide cultural variation.",
      "Public voting systems need authentication, spam protection, privacy, and clear statistics.",
      "The goal is to design and develop a practical platform for cross-cultural opinion analysis.",
    ]),
    sectionSlide("Research and Engineering Objective", [
      "Collect structured votes and qualitative comments.",
      "Compare opinions by country, age band, and gender.",
      "Use AI only as an explanatory assistant, not as a decision maker.",
      "Implement the system using modern full-stack technologies.",
    ]),
    imageSlide("System Overview", [
      "React/Vite SPA communicates with ASP.NET Core Web API.",
      "MediatR handlers implement application use cases.",
      "PostgreSQL stores durable relational data.",
      "Redis supports cache and rate limiting.",
      "Docker Compose runs the required services.",
    ], screenshots.home3),
    matrixSlide("Contribution Map", ["Contribution", "Implementation Evidence", "Academic Value"], [
      ["Voting platform", "Question, option, vote, user, and cooldown logic.", "Structured opinion collection."],
      ["Comparative statistics", "Country, option, age, gender, and global baseline views.", "Cross-cultural interpretation support."],
      ["Discussion analysis", "Comments, likes, replies, and AI summaries.", "Combines quantitative and qualitative signals."],
      ["Responsible design", "Rate limits, IP hashing, consent, and admin roles.", "Privacy-aware engineering prototype."],
    ], { rowH: 62 }),
    sectionSlide("Core Contribution 1: Voting", [
      "Authenticated users can vote on binary or multi-option questions.",
      "Database uniqueness enforces one active vote per question per user.",
      "Vote changes are allowed after a 24-hour cooldown.",
      "Country metadata is stored for comparison, while raw IP is not persisted.",
    ]),
    imageSlide("Core Contribution 2: Statistics", [
      "Option distribution shows count and percentage.",
      "Country distribution enables geographic comparison.",
      "Demographic breakdowns use user profile fields.",
      "Leaderboard uses daily aggregated views and votes.",
    ], screenshots.leaderboard),
    imageSlide("Core Contribution 3: Cross-Country Analysis", [
      "Country comparison shows two national vote patterns and a global baseline.",
      "The UI highlights biggest split, overlap score, and closest-to-global signal.",
      "AI text uses tentative language and fallback behavior.",
      "Small-sample suppression is identified as a future improvement.",
    ], screenshots.countryCompare),
    sectionSlide("Security and Privacy", [
      "Identity password rules, email confirmation, JWT validation, and refresh-token rotation.",
      "Role-based admin authorization and CORS allowlisting.",
      "Redis-backed abuse counters for login, forgot password, voting, views, and AI summary.",
      "Salted IP hashes, analytics consent, and security response headers.",
    ]),
    twoColumnSlide("Quality Review", "Verified by Documentation", [
      "Screenshots demonstrate completed frontend flows.",
      "Architecture and data model are described in the thesis.",
      "Installation PDF lists environment and run steps.",
      "User guide explains role-specific usage.",
    ], "Residual Engineering Risk", [
      "Test coverage remains limited.",
      "Production monitoring is not yet configured.",
      "Data export and deletion workflows need extension.",
      "Small sample protections should be enforced in UI and API.",
    ]),
    sectionSlide("Evaluation", [
      "Functional review confirms implementation of the planned flows.",
      "Screenshots demonstrate completed user and admin interfaces.",
      "Build verification should be run before submission.",
      "Test coverage is the main engineering weakness and should be expanded.",
    ]),
    sectionSlide("Limitations", [
      "Results are platform participation signals, not representative national statistics.",
      "GeoIP can be inaccurate under VPNs, proxies, or mobile routing.",
      "AI summaries can miss nuance and must remain labeled.",
      "Comment moderation and minimum-threshold privacy suppression need production work.",
    ]),
    processSlide("Future Work Roadmap", [
      { title: "Data Quality", text: "Weighted sampling, confidence intervals, and sample-size warnings." },
      { title: "Safety", text: "Moderation, reporting, audit logging, and admin review queues." },
      { title: "Testing", text: "Automated unit, integration, and browser workflow tests." },
      { title: "Operations", text: "Secret management, CI/CD, backups, monitoring, export, and deletion." },
    ]),
    highlightSlide("Final Claim", "WorldDeciding is a complete full-stack prototype for exploratory cross-cultural opinion analysis.", [
      "It combines public voting, comparison, comments, AI-assisted summaries, admin tooling, and privacy controls.",
      "Its results must be interpreted as platform participation signals, not representative national statistics.",
      "The design is extensible enough for future research and production hardening.",
    ]),
    sectionSlide("Conclusion", [
      "WorldDeciding implements a complete full-stack prototype for cross-cultural opinion analysis.",
      "The project combines voting, statistics, discussion, AI assistance, security controls, and admin tooling.",
      "The thesis contribution is the design and development of a practical, extensible, privacy-aware opinion platform.",
    ]),
  ], themes.defense);

  return [termStart, literature, design, results, finalDefense];
}

function createDocumentPdf(fileName, titleText, subtitle, sections) {
  const file = path.join(outDir, fileName);
  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: titleText } });
  doc.pipe(fs.createWriteStream(file));
  const bottom = doc.page.height - 72;

  function footer() {
    doc.font("Helvetica").fontSize(8.5).fillColor("#6B7280").text(`${projectName} | ${generatedDate}`, 56, doc.page.height - 46, {
      width: doc.page.width - 112,
      align: "center",
    });
  }

  function ensureSpace(height) {
    if (doc.y + height > bottom) {
      footer();
      doc.addPage();
      doc.y = 56;
    }
  }

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#163B5C").text(titleText, { lineGap: 4 });
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(12.5).fillColor("#4B5563").text(subtitle, { lineGap: 4 });
  doc.moveDown(1.2);

  sections.forEach((section) => {
    ensureSpace(90);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#1F2937").text(section.heading);
    doc.moveDown(0.35);
    if (section.body) {
      doc.font("Helvetica").fontSize(10.8).fillColor("#111827").text(section.body, { lineGap: 3 });
      doc.moveDown(0.45);
    }
    if (section.items) {
      section.items.forEach((item) => {
        ensureSpace(36);
        doc.font("Helvetica").fontSize(10.5).fillColor("#111827").text(`- ${item}`, { indent: 12, lineGap: 2 });
      });
      doc.moveDown(0.55);
    }
  });

  footer();
  doc.end();
  return file;
}

function createUserGuidePdf() {
  return createDocumentPdf(
    "WorldDeciding_User_Guide.pdf",
    "WorldDeciding User Guide",
    "English usage guide for visitors, registered users, and administrators.",
    [
      {
        heading: "Purpose",
        body:
          "WorldDeciding is a web platform for collecting votes on public questions and exploring how participation patterns differ across countries and demographic groups. Results should be interpreted as platform participation signals, not representative national survey estimates.",
      },
      {
        heading: "Visitor Features",
        items: [
          "Open the home page to view the live question, recent questions, categories, and public navigation.",
          "Browse question lists, category pages, leaderboard pages, and public statistics where available.",
          "Use public views for discovery. Voting, commenting, likes, profile editing, and AI summaries require an account.",
        ],
      },
      {
        heading: "Account Registration and Login",
        items: [
          "Create an account with email, password, country, birth date, and gender fields.",
          "Confirm the email address before logging in when email confirmation is enabled.",
          "Use the login page to start an authenticated session. Access tokens are handled by the frontend and refresh tokens are stored in an HttpOnly cookie.",
          "Use forgot password and reset password screens when password recovery is needed.",
        ],
      },
      {
        heading: "Voting and Statistics",
        items: [
          "Open a question detail page and select one answer option.",
          "Submit the vote. The platform enforces one active vote per user for each question and applies a cooldown before vote changes.",
          "Open the statistics view to inspect option distribution, country distribution, age-band distribution, gender distribution, views, and vote totals.",
          "Use country comparison to select two countries and compare their option splits against the global platform baseline.",
        ],
      },
      {
        heading: "Discussion and AI Summary",
        items: [
          "Authenticated users can post comments, reply to comments, like comments, and sort discussion by new or top.",
          "AI summaries condense discussion signals and should be read as tentative assistance, not as a final interpretation.",
          "Abuse and rate limits may temporarily block repeated votes, views, password attempts, comments, or AI summary requests.",
        ],
      },
      {
        heading: "Profile, Privacy, and Consent",
        items: [
          "Use the profile page to review or update public profile information where supported.",
          "Cookie and privacy pages explain consent and data handling.",
          "Analytics is optional and should only run after analytics consent is granted.",
        ],
      },
      {
        heading: "Administrator Features",
        items: [
          "Admin users can open the admin dashboard to manage questions and categories.",
          "Create, publish, archive, and review questions through admin question screens.",
          "Use bulk import for structured question creation. Import validation checks category, language, text length, options, and duplicate content.",
          "Admin endpoints are protected by role-based authorization.",
        ],
      },
    ]
  );
}

function createInstallationPdf() {
  return createDocumentPdf(
    "WorldDeciding_Installation_Instructions.pdf",
    "WorldDeciding Installation Instructions",
    "English setup notes for local development and Docker-based execution.",
    [
      {
        heading: "Prerequisites",
        items: [
          ".NET 8 SDK for building and running the ASP.NET Core API.",
          "Node.js and npm for installing and building the React/Vite frontend.",
          "Docker Desktop or Docker Engine with Docker Compose for PostgreSQL, Redis, and containerized services.",
          "A Gemini API key if AI summary features will be used.",
        ],
      },
      {
        heading: "Repository Layout",
        items: [
          "WorldDeciding: ASP.NET Core API project.",
          "WorldDeciding.Application: commands, queries, DTOs, validators, and interfaces.",
          "WorldDeciding.Domain: entities and identity models.",
          "WorldDeciding.Infrastructure: EF Core, Redis, email, GeoIP, token, and AI implementations.",
          "worlddeciding-frontend: React, TypeScript, Vite, and Tailwind frontend.",
          "documentation: generated thesis, presentations, and support documents.",
        ],
      },
      {
        heading: "Environment Variables",
        items: [
          "Create or update .env before Docker execution.",
          "Set POSTGRES_PASSWORD, JWT_KEY, REFRESHTOKEN_PEPPER, PRIVACY_IPSALT, GEMINI_API_KEY, and PGADMIN_PASSWORD.",
          "Optionally set POSTGRES_USER, POSTGRES_DB, FRONTEND_BASE_URL, API_BASE_URL, CORS_ALLOWED_ORIGIN_0, CORS_ALLOWED_ORIGIN_1, GEMINI_MODEL, and GEMINI_API_VERSION.",
          "Do not commit real production secrets to source control.",
        ],
      },
      {
        heading: "Docker Compose Run",
        items: [
          "From the repository root, run: docker compose up -d --build",
          "The API container listens on port 8080 inside the compose configuration.",
          "PostgreSQL is published on host port 5433, Redis on 6379, pgAdmin on 5050, and RedisInsight on 5540.",
          "Check container health with: docker compose ps",
          "Stop the stack with: docker compose down",
        ],
      },
      {
        heading: "Backend Development Run",
        items: [
          "Restore packages with: dotnet restore WorldDeciding.sln",
          "Build with: dotnet build WorldDeciding.sln",
          "Apply EF Core migrations to the configured PostgreSQL database when required.",
          "Run the API with: dotnet run --project WorldDeciding/WorldDeciding.csproj",
          "Use appsettings.Development.json and local environment variables for development settings.",
        ],
      },
      {
        heading: "Frontend Development Run",
        items: [
          "Open worlddeciding-frontend.",
          "Install packages with: npm install",
          "Run the development server with: npm run dev",
          "Build production assets with: npm run build",
          "Configure the frontend API base URL according to the environment used by the API.",
        ],
      },
      {
        heading: "Documentation Generation",
        items: [
          "The documentation generator is documentation/generate-deliverables.mjs.",
          "It requires pdfkit and docx packages. In this repository those dependencies can be resolved from worlddeciding-frontend/node_modules when DOCGEN_REQUIRE_BASE points to that folder.",
          "Example PowerShell command: $env:DOCGEN_REQUIRE_BASE='worlddeciding-frontend'; node documentation/generate-deliverables.mjs",
          "Generated files are written to documentation/deliverables.",
        ],
      },
      {
        heading: "Post-Install Verification",
        items: [
          "Open the frontend and confirm that public pages load.",
          "Register a test account, confirm email behavior according to the configured email provider, and log in.",
          "Create or publish a question as an admin user, vote as a registered user, and open statistics.",
          "Verify Redis-backed rate limits and AI summary behavior only after required secrets are configured.",
        ],
      },
    ]
  );
}

function createLicenseTxt() {
  const file = path.join(outDir, "WorldDeciding_License_Information.txt");
  const text = `WorldDeciding License Information
Generated: ${generatedDate}

Project license status:
No repository-level open source license file was found at the time this deliverable was generated. Unless the project owner or institution provides a separate written license, the WorldDeciding source code, documentation, screenshots, and generated deliverables should be treated as all rights reserved.

Academic use:
These materials may be submitted, reviewed, and archived for the related academic thesis/project evaluation according to the applicable university rules. Redistribution, commercial use, sublicensing, or reuse in another project requires permission from the project owner.

Third-party software:
WorldDeciding uses third-party frameworks and libraries, including but not limited to .NET, ASP.NET Core, Entity Framework Core, MediatR, PostgreSQL, Redis, React, Vite, TypeScript, Tailwind CSS, Axios, React Query, Docker, pdfkit, and docx. Each dependency remains governed by its own license terms. Review the package metadata and official project repositories before redistribution or production release.

Screenshots and assets:
Screenshots generated from the WorldDeciding application are part of the project documentation. Do not reuse them outside the academic/project context without permission.

Future recommendation:
Before publishing the repository publicly, add an explicit LICENSE file at the repository root and verify compatibility of all third-party dependency licenses.
`;
  fs.writeFileSync(file, text, "utf8");
  return file;
}

function createSupportDocs() {
  return [createUserGuidePdf(), createInstallationPdf(), createLicenseTxt()];
}

const docx = await makeDocx();
const pdfs = createPresentations();
const supportDocs = createSupportDocs();
console.log(JSON.stringify({ docx, pdfs, supportDocs }, null, 2));
