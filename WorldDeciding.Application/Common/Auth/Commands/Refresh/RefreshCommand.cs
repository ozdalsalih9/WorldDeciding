using MediatR;
using WorldDeciding.Application.Common.Auth.Models;

namespace WorldDeciding.Application.Auth.Commands.Refresh;

public sealed record RefreshCommand(string RefreshToken) : IRequest<AuthTokensDto>;
