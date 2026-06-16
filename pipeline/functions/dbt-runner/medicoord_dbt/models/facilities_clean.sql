{{
  config(
    materialized = 'table',
    alias        = 'facilities_clean'
  )
}}

select
    f.id                                            as facility_id,
    trim(f.name)                                    as facility_name,
    f.category,
    f.source_facility_type,
    f.accepted_severity,
    f.address,
    f.lat,
    f.lng,
    f.phone,
    f.google_place_id,

    -- normalise to uppercase for consistent downstream filtering
    upper(f.business_status)                        as business_status,

    -- stable operational signal derived from business_status;
    -- avoids relying on the dropped open_now point-in-time column
    case
        when upper(f.business_status) = 'OPERATIONAL' then true
        else false
    end                                             as is_operational,

    f.weekday_hours,
    f.last_enriched_at,
    current_timestamp                               as dbt_run_at

from public.facilities f

where
    -- only include fully-enriched facilities: partial enrichment (NULL business_status)
    -- stays in facilities but is excluded from the clean routing dataset
    f.google_place_id    is not null
    and f.business_status is not null
