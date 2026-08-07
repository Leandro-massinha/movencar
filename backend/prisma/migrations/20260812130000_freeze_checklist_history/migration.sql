-- Historical checklist instances must keep the exact template content they used.
-- Template lifecycle flags remain editable, but versioned content becomes immutable
-- as soon as the template is referenced by an instance.
CREATE OR REPLACE FUNCTION "protect_referenced_checklist_template"()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ChecklistInstance"
    WHERE "templateId" = OLD."id" AND "templateVersion" = OLD."version"
  ) AND (
    TG_OP = 'DELETE' OR
    NEW."id" IS DISTINCT FROM OLD."id" OR
    NEW."companyId" IS DISTINCT FROM OLD."companyId" OR
    NEW."name" IS DISTINCT FROM OLD."name" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR
    NEW."type" IS DISTINCT FROM OLD."type" OR
    NEW."version" IS DISTINCT FROM OLD."version" OR
    NEW."isSystem" IS DISTINCT FROM OLD."isSystem"
  ) THEN
    RAISE EXCEPTION 'referenced checklist template content is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChecklistTemplate_history_guard"
BEFORE UPDATE OR DELETE ON "ChecklistTemplate"
FOR EACH ROW EXECUTE FUNCTION "protect_referenced_checklist_template"();

CREATE OR REPLACE FUNCTION "protect_referenced_checklist_structure"()
RETURNS trigger AS $$
DECLARE
  referenced_template_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'ChecklistTemplateSection' THEN
    referenced_template_id := COALESCE(NEW."templateId", OLD."templateId");
  ELSE
    SELECT "templateId" INTO referenced_template_id
    FROM "ChecklistTemplateSection"
    WHERE "id" = COALESCE(NEW."sectionId", OLD."sectionId");
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ChecklistInstance" WHERE "templateId" = referenced_template_id
  ) THEN
    RAISE EXCEPTION 'referenced checklist structure is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChecklistTemplateSection_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ChecklistTemplateSection"
FOR EACH ROW EXECUTE FUNCTION "protect_referenced_checklist_structure"();

CREATE TRIGGER "ChecklistTemplateItem_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ChecklistTemplateItem"
FOR EACH ROW EXECUTE FUNCTION "protect_referenced_checklist_structure"();

-- A result must belong to the instance's exact template and carry only the
-- value compatible with the configured response type. Completed instances
-- cannot receive inserts, updates or deletes through any database client.
CREATE OR REPLACE FUNCTION "validate_checklist_result"()
RETURNS trigger AS $$
DECLARE
  instance_template_id uuid;
  instance_status "ChecklistInstanceStatus";
  configured_type "ChecklistResponseType";
  item_template_id uuid;
BEGIN
  SELECT "templateId", "status" INTO instance_template_id, instance_status
  FROM "ChecklistInstance"
  WHERE "id" = COALESCE(NEW."instanceId", OLD."instanceId")
    AND "companyId" = COALESCE(NEW."companyId", OLD."companyId");
  IF instance_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'completed checklist results are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT i."responseType", s."templateId" INTO configured_type, item_template_id
  FROM "ChecklistTemplateItem" i
  JOIN "ChecklistTemplateSection" s ON s."id" = i."sectionId"
  WHERE i."id" = NEW."itemId" AND i."active" = true;
  IF item_template_id IS DISTINCT FROM instance_template_id THEN
    RAISE EXCEPTION 'checklist item does not belong to instance template' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (configured_type = 'STATUS' AND NEW."status" IS NOT NULL AND NEW."textValue" IS NULL AND NEW."numericValue" IS NULL AND NEW."selectedValue" IS NULL) OR
    (configured_type = 'TEXT' AND length(btrim(NEW."textValue")) > 0 AND NEW."status" IS NULL AND NEW."numericValue" IS NULL AND NEW."selectedValue" IS NULL) OR
    (configured_type = 'NUMBER' AND NEW."numericValue" IS NOT NULL AND NEW."status" IS NULL AND NEW."textValue" IS NULL AND NEW."selectedValue" IS NULL) OR
    (configured_type = 'SELECT' AND length(btrim(NEW."selectedValue")) > 0 AND NEW."status" IS NULL AND NEW."textValue" IS NULL AND NEW."numericValue" IS NULL)
  ) THEN
    RAISE EXCEPTION 'checklist result does not match response type' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChecklistItemResult_value_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ChecklistItemResult"
FOR EACH ROW EXECUTE FUNCTION "validate_checklist_result"();
