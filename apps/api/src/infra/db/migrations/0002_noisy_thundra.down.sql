-- Rollback version column type from integer back to bigint
DO $$
BEGIN
    -- Check if column exists and change type back if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_session_event' 
        AND column_name = 'version' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "quiz_session_event" ALTER COLUMN "version" SET DATA TYPE bigint;
        ALTER TABLE "quiz_session_event" ALTER COLUMN "version" SET DEFAULT 1;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_session_snapshot' 
        AND column_name = 'version' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "quiz_session_snapshot" ALTER COLUMN "version" SET DATA TYPE bigint;
    END IF;
END $$;