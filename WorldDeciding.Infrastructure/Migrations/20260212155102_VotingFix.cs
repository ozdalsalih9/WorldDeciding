using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorldDeciding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class VotingFix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_IpHash_VoteDate",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_UserId_VoteDate",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "VoteDate",
                table: "Votes");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_IpHash",
                table: "Votes",
                columns: new[] { "QuestionId", "IpHash" });

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_UserId",
                table: "Votes",
                columns: new[] { "QuestionId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_IpHash",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_UserId",
                table: "Votes");

            migrationBuilder.AddColumn<DateOnly>(
                name: "VoteDate",
                table: "Votes",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_IpHash_VoteDate",
                table: "Votes",
                columns: new[] { "QuestionId", "IpHash", "VoteDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Votes_QuestionId_UserId_VoteDate",
                table: "Votes",
                columns: new[] { "QuestionId", "UserId", "VoteDate" },
                unique: true);
        }
    }
}
