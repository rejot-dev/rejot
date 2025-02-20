UPDATE data_store 
SET publication_name = 'unset_publication_name_default_value' 
WHERE publication_name IS NULL;

ALTER TABLE "data_store" ALTER COLUMN "publication_name" SET NOT NULL;