using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.CreateQuestion;

public class CreateQuestionHandler : IRequestHandler<CreateQuestionCommand, QuestionDto>
{
    private readonly IAppDbContext _db;
    private readonly IMapper _mapper;

    public CreateQuestionHandler(IAppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<QuestionDto> Handle(CreateQuestionCommand request, CancellationToken ct)
    {
        var exists = await _db.Questions.AnyAsync(q => q.Title == request.Title, ct);
        if (exists) throw new InvalidOperationException("Question with same title already exists.");

        var q = new Question
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Type = request.Type,
            CategoryId = request.CategoryId,
            Options = request.Options.Select(o => new Option { Id = Guid.NewGuid(), Text = o.Trim() }).ToList()
        };


        _db.Questions.Add(q);
        await _db.SaveChangesAsync(ct);

        return new QuestionDto
        {
            Id = q.Id,
            Title = q.Title,
            Type = q.Type,
            Options = q.Options.Select(o => o.Text).ToList()
        };
    }
}
