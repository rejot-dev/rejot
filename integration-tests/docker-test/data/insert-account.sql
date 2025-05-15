WITH
  inserted_account AS (
    INSERT INTO
      account (first_name, last_name)
    VALUES
      ('Alice', 'Smith')
    RETURNING
      id
  )
INSERT INTO
  account_emails (account_id, email)
SELECT
  id,
  'alice1@example.com'
FROM
  inserted_account
UNION ALL
SELECT
  id,
  'alice2@example.com'
FROM
  inserted_account;
