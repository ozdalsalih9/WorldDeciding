using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorldDeciding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class QViewAndIPLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Votes_UserId_QuestionId",
                table: "Votes");

            migrationBuilder.AddColumn<string>(
                name: "IpHash",
                table: "Votes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateOnly>(
                name: "VoteDate",
                table: "Votes",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateTable(
                name: "QuestionViews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IpHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ViewDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionViews", x => x.Id);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_QuestionViews_QuestionId_IpHash_ViewDate",
                table: "QuestionViews",
                columns: new[] { "QuestionId", "IpHash", "ViewDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionViews_QuestionId_UserId_ViewDate",
                table: "QuestionViews",
                columns: new[] { "QuestionId", "UserId", "ViewDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionViews");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_IpHash_VoteDate",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_QuestionId_UserId_VoteDate",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "IpHash",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "VoteDate",
                table: "Votes");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_UserId_QuestionId",
                table: "Votes",
                columns: new[] { "UserId", "QuestionId" },
                unique: true);
        }
    }
}
