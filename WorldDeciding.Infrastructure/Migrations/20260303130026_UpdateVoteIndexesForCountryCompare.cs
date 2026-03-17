using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorldDeciding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateVoteIndexesForCountryCompare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_CountryCode",
                table: "Votes",
                columns: new[] { "QuestionId", "CountryCode" });

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_CountryCode_OptionId",
                table: "Votes",
                columns: new[] { "QuestionId", "CountryCode", "OptionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_OptionId",
                table: "Votes",
                columns: new[] { "QuestionId", "OptionId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_CountryCode",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_CountryCode_OptionId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_OptionId",
                table: "Votes");
        }
    }
}
