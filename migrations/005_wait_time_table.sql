create table if not exists wait_times (
    id           bigserial    primary key,
    facility_id  uuid         not null references facilities(id),
    wait_minutes integer      not null,
    raw_wait     text,
    source       text,
    scraped_at   timestamptz,
    recorded_at  timestamptz  default now()
);

create unique index if not exists wait_times_facility_scraped_idx
    on wait_times (facility_id, scraped_at);