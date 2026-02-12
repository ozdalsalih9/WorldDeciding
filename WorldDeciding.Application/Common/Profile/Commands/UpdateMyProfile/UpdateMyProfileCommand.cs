using MediatR;
using WorldDeciding.Application.Common.Profile;

namespace WorldDeciding.Application.Profile.Commands.UpdateMyProfile;

public record UpdateMyProfileCommand(UpdateMyProfileReq Req) : IRequest<MyProfileDto>;
