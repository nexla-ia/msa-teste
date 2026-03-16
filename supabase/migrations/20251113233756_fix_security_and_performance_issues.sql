/*
  # Fix Security and Performance Issues

  This migration addresses several security and performance issues:

  1. **RLS Policy Performance Optimization**
     - Update `usuarios` table policies to use `(select auth.uid())` instead of `auth.uid()`
     - This prevents re-evaluation of auth functions for each row, improving query performance at scale

  2. **Unused Index Removal**
     - Remove unused index `idx_logs_usuario_id` from `logs` table

  3. **Function Search Path Security**
     - Fix `cleanup_old_logs` function to use immutable search_path
     - Prevents potential security vulnerabilities from search_path manipulation

  ## Changes Made
  
  ### RLS Policies on usuarios table:
  - Drop and recreate policies with optimized auth function calls
  - Policies affected: ADM can insert, ADM or self can update, ADM can delete

  ### Index Optimization:
  - Remove unused index on logs.usuario_id

  ### Function Security:
  - Add explicit schema qualification to cleanup_old_logs function
  - Recreate trigger with updated function
*/

-- Drop existing RLS policies on usuarios table
DROP POLICY IF EXISTS "ADM can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM or self can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "ADM can delete usuarios" ON usuarios;

-- Recreate policies with optimized auth function calls
CREATE POLICY "ADM can insert usuarios"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM or self can update usuarios"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

CREATE POLICY "ADM can delete usuarios"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND nivel_acesso = 'ADM'
    )
  );

-- Remove unused index on logs table
DROP INDEX IF EXISTS idx_logs_usuario_id;

-- Drop trigger first, then function, then recreate both with proper search_path
DROP TRIGGER IF EXISTS trigger_cleanup_logs ON logs;
DROP FUNCTION IF EXISTS cleanup_old_logs() CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.logs
  WHERE data_hora < NOW() - INTERVAL '90 days';
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_logs() IS 'Removes log entries older than 90 days. Search path is set to prevent security vulnerabilities.';

-- Recreate the trigger
CREATE TRIGGER trigger_cleanup_logs
  AFTER INSERT ON logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_logs();
