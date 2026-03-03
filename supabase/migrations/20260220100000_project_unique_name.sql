-- 프로젝트 이름 중복 금지 (활성 프로젝트 기준)
-- soft delete된 프로젝트의 이름은 재사용 가능
CREATE UNIQUE INDEX idx_project_name_unique
  ON public.project(name)
  WHERE deleted_at IS NULL;
