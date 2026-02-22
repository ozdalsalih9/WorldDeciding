using MediatR;
using WorldDeciding.Application.Common.Admin;

namespace WorldDeciding.Application.Questions.Commands.BulkImportQuestions;

public record BulkImportQuestionsCommand(List<ImportQuestionItem> Items) : IRequest<BulkImportResult>;