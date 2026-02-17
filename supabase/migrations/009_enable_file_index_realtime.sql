-- Enable Supabase Realtime on file_index table for sidebar live updates.
-- The sidebar subscribes to file_index changes to update domain slots
-- and cross-cutting insights in real time during life-mapping conversations.

-- Set replica identity to FULL so Realtime can track all column changes
ALTER TABLE file_index REPLICA IDENTITY FULL;

-- Add file_index to the Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE file_index;
