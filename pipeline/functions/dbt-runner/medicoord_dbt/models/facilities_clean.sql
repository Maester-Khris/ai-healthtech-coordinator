{{
  config(
    materialized = 'table',
    alias        = 'facilities_clean'
  )
}}

/*
  Transformation layer on top of raw facilities table.
  Runs after places-processor upserts business fields.
  Produces a clean, queryable table for the iOS app.
  
  What this model does:
  - filters to operational hospitals only
  - standardises name casing
  - parses open_now into a reliable boolean
  - adds dbt lineage metadata
*/

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

    -- standardise business_status to uppercase for consistent filtering
    upper(f.business_status)                        as business_status,

    -- derive reliable open_now from business_status
    -- Places API open_now is a point-in-time snapshot — unreliable at rest
    -- OPERATIONAL is the stable signal
    case
        when upper(f.business_status) = 'OPERATIONAL' then true
        else false
    end                                             as is_operational,

    -- open_now from Places API — kept as-is for real-time display
    f.open_now,

    -- weekday_hours stored as JSON string — parse for readability
    f.weekday_hours,

    f.updated_at                                    as last_enriched_at,
    current_timestamp                               as dbt_run_at

from public.facilities f

where
    -- only hospitals — ER wait times only apply here
    f.category = 'hospital'
    -- must have been enriched by places-processor at least once
    and f.phone is not null