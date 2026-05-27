ALTER TABLE "copernicus_snapshots" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "copernicus_snapshots" ADD COLUMN "data_quality" jsonb;--> statement-breakpoint
UPDATE "copernicus_snapshots"
SET
	"sources" = '[]'::jsonb,
	"data_quality" = '{"confidence":"low","completeness":0,"scoreCap":{"applied":false,"maxScore":null,"reason":null},"warnings":["Historical snapshot created before source metadata was added."],"limitations":[]}'::jsonb
WHERE "sources" IS NULL OR "data_quality" IS NULL;--> statement-breakpoint
ALTER TABLE "copernicus_snapshots" ALTER COLUMN "sources" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "copernicus_snapshots" ALTER COLUMN "data_quality" SET NOT NULL;
