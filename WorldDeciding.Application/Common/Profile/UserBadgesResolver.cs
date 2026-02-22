namespace WorldDeciding.Application.Common.Profile;

public static class UserBadgesResolver
{
    public static IReadOnlyList<string> Resolve(int totalVotes, int totalComments, int likesReceived, int score)
    {
        var list = new List<string>();

        if (totalVotes >= 1) list.Add("First Vote");
        if (totalComments >= 5) list.Add("Contributor");
        if (likesReceived >= 10) list.Add("Popular");
        if (score >= 100) list.Add("Active");

        return list;
    }
}
