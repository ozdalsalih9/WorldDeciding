public static class UserRankResolver
{
    public static string GetTag(int score)
    {
        if (score >= 1500) return "Decider";
        if (score >= 700) return "Effective";
        if (score >= 300) return "Active";
        if (score >= 100) return "Contributor";
        return "Rookie";
    }

    public static int GetStars(int score)
    {
        return Math.Min(score / 100, 5); // max 5 yıldız
    }
}
