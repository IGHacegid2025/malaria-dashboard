-- Malaria Dashboard database schema
-- Author: Khadim Gueye

CREATE TABLE states (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE publications (
    id SERIAL PRIMARY KEY,
    author VARCHAR(200) NOT NULL,
    year_of_publication INTEGER NOT NULL,
    doi VARCHAR(200),
    title TEXT,
    state_id INTEGER REFERENCES states(id),
    city VARCHAR(100),
    sample_size INTEGER,
    corrected_year INTEGER NOT NULL,
    comment TEXT
);

CREATE TABLE sequencing_batches (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    state_id INTEGER REFERENCES states(id),
    total_samples INTEGER NOT NULL
);

CREATE TABLE genes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE mutations (
    id SERIAL PRIMARY KEY,
    gene_id INTEGER REFERENCES genes(id) NOT NULL,
    mutation_code VARCHAR(50) NOT NULL,
    UNIQUE (gene_id, mutation_code)
);

CREATE TABLE observations (
    id SERIAL PRIMARY KEY,
    mutation_id INTEGER REFERENCES mutations(id) NOT NULL,
    state_id INTEGER REFERENCES states(id) NOT NULL,
    year INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('publication', 'sequencing')),
    publication_id INTEGER REFERENCES publications(id),
    sequencing_batch_id INTEGER REFERENCES sequencing_batches(id),
    prevalence NUMERIC(6, 4),
    sample_count INTEGER,
    CHECK (
        (source_type = 'publication' AND publication_id IS NOT NULL AND sequencing_batch_id IS NULL) OR
        (source_type = 'sequencing' AND sequencing_batch_id IS NOT NULL AND publication_id IS NULL)
    )
);

CREATE INDEX idx_observations_state_year ON observations(state_id, year);
CREATE INDEX idx_observations_mutation ON observations(mutation_id);

CREATE TABLE species_observations (
    id SERIAL PRIMARY KEY,
    state_id INTEGER REFERENCES states(id) NOT NULL,
    year INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('publication', 'sequencing')),
    publication_id INTEGER REFERENCES publications(id),
    sequencing_batch_id INTEGER REFERENCES sequencing_batches(id),
    species_combination VARCHAR(50) NOT NULL,
    sample_count INTEGER
);

CREATE TABLE hrp_deletions (
    id SERIAL PRIMARY KEY,
    state_id INTEGER REFERENCES states(id) NOT NULL,
    year INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('publication', 'sequencing')),
    publication_id INTEGER REFERENCES publications(id),
    sequencing_batch_id INTEGER REFERENCES sequencing_batches(id),
    gene VARCHAR(10) NOT NULL CHECK (gene IN ('hrp2', 'hrp3', 'none')),
    any_hrp_mutation BOOLEAN,
    location TEXT,
    sample_count INTEGER
);

CREATE TABLE moi_distribution (
    id SERIAL PRIMARY KEY,
    sequencing_batch_id INTEGER REFERENCES sequencing_batches(id) NOT NULL,
    moi_value INTEGER NOT NULL,
    sample_count INTEGER NOT NULL
);

CREATE TABLE mis_cases (
    id SERIAL PRIMARY KEY,
    state_id INTEGER REFERENCES states(id) NOT NULL,
    year INTEGER NOT NULL,
    prevalence NUMERIC(6, 4),
    malaria VARCHAR(20),
    is_mis BOOLEAN
);

CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    authors VARCHAR(500),
    journal VARCHAR(200),
    year INTEGER,
    doi VARCHAR(200),
    url TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE lab_activities (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    activity_date DATE,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT now()
);
