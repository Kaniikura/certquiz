-- Safely change version column type from bigint to integer
DO $$
BEGIN
    -- Check if column exists and change type if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_session_event' 
        AND column_name = 'version' 
        AND data_type = 'bigint'
    ) THEN
        ALTER TABLE "quiz_session_event" ALTER COLUMN "version" SET DATA TYPE integer;
        ALTER TABLE "quiz_session_event" ALTER COLUMN "version" SET DEFAULT 1;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_session_snapshot' 
        AND column_name = 'version' 
        AND data_type = 'bigint'
    ) THEN
        ALTER TABLE "quiz_session_snapshot" ALTER COLUMN "version" SET DATA TYPE integer;
    END IF;
END $$;