-- Destination Accounts table
CREATE TABLE destination_accounts (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);
