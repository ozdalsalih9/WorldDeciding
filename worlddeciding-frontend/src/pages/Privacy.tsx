const sections = [
  {
    title: 'What We Collect',
    body:
      'We store the information required to run your account and keep the platform functional, such as your email address, profile details, authentication status, and the actions you take on questions.',
  },
  {
    title: 'How We Use Data',
    body:
      'Your data is used to authenticate you, personalize your experience, display your participation history, protect the platform from abuse, and improve product decisions through aggregate usage analysis.',
  },
  {
    title: 'Sharing and Security',
    body:
      'We do not sell personal data. Information may be processed by trusted infrastructure providers strictly to operate the service. Reasonable technical safeguards are used to protect stored data, but no system can guarantee absolute security.',
  },
  {
    title: 'Your Controls',
    body:
      'You can review or update profile information from your account area. If you need account removal or a data-related request handled manually, contact the project administrators through the support channel you were given when accessing the service.',
  },
]

export default function Privacy() {
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="surface p-6 sm:p-8">
        <div className="space-y-4">
          <span className="pill">Privacy Policy</span>
          <div className="space-y-3">
            <h1 className="heading-1">Privacy at WorldDeciding</h1>
            <p className="text-sm text-muted">
              This page explains the core data handling rules for WorldDeciding. It is a product-level summary for users and should be read together with any additional notices shown during sign-up or account use.
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Last updated: March 1, 2026</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map((section) => (
          <article key={section.title} className="surface p-6 sm:p-7">
            <div className="space-y-3">
              <h2 className="heading-2">{section.title}</h2>
              <p className="text-sm leading-7 text-muted">{section.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="surface p-6 sm:p-7">
        <div className="space-y-3">
          <h2 className="heading-2">Retention</h2>
          <p className="text-sm leading-7 text-muted">
            Account and activity data are kept only as long as needed to operate the service, investigate abuse, maintain records tied to product functionality, or satisfy legal obligations that apply to the deployment of this project.
          </p>
        </div>
      </div>
    </section>
  )
}
