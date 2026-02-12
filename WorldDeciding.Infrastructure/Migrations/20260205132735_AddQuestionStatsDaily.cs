using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorldDeciding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionStatsDaily : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_question_stats_daily_Questions_QuestionId",
                table: "question_stats_daily");

            migrationBuilder.DropPrimaryKey(
                name: "PK_question_stats_daily",
                table: "question_stats_daily");

            migrationBuilder.RenameTable(
                name: "question_stats_daily",
                newName: "QuestionStatsDaily");

            migrationBuilder.AddPrimaryKey(
                name: "PK_QuestionStatsDaily",
                table: "QuestionStatsDaily",
                columns: new[] { "QuestionId", "Date" });

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionStatsDaily_Questions_QuestionId",
                table: "QuestionStatsDaily",
                column: "QuestionId",
                principalTable: "Questions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QuestionStatsDaily_Questions_QuestionId",
                table: "QuestionStatsDaily");

            migrationBuilder.DropPrimaryKey(
                name: "PK_QuestionStatsDaily",
                table: "QuestionStatsDaily");

            migrationBuilder.RenameTable(
                name: "QuestionStatsDaily",
                newName: "question_stats_daily");

            migrationBuilder.AddPrimaryKey(
                name: "PK_question_stats_daily",
                table: "question_stats_daily",
                columns: new[] { "QuestionId", "Date" });

            migrationBuilder.AddForeignKey(
                name: "FK_question_stats_daily_Questions_QuestionId",
                table: "question_stats_daily",
                column: "QuestionId",
                principalTable: "Questions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
