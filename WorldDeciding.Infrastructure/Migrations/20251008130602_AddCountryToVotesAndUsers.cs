using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorldDeciding.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCountryToVotesAndUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CountryCode",
                table: "Votes",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CountryConfidence",
                table: "Votes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CountryProvider",
                table: "Votes",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "CountrySource",
                table: "Votes",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<string>(
                name: "CountryCode",
                table: "AspNetUsers",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CountryCode",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "CountryConfidence",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "CountryProvider",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "CountrySource",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "CountryCode",
                table: "AspNetUsers");
        }
    }
}
