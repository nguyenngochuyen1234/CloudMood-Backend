-- Make mood entries independent from users so moods can be shared globally.
ALTER TABLE "MoodEntry" DROP CONSTRAINT "MoodEntry_userId_fkey";

ALTER TABLE "MoodEntry"
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "MoodEntry"
ADD CONSTRAINT "MoodEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
