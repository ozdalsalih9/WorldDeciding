using MediatR;
using WorldDeciding.Application.Common.Profile;

namespace WorldDeciding.Application.Profile.Queries.GetMyProfile;

public record GetMyProfileQuery : IRequest<MyProfileDto>;
