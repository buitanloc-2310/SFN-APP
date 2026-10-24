-- Remove the technical homepage callout without deleting other CMS content.
-- Safe to apply after 0011/0012; the public homepage no longer renders this CMS zone.
UPDATE cms_pages
SET
  blocks_json = COALESCE((
    SELECT json_group_array(json(j.value))
    FROM json_each(CASE WHEN json_valid(cms_pages.blocks_json) THEN cms_pages.blocks_json ELSE '[]' END) AS j
    WHERE COALESCE(json_extract(j.value, '$.id'), '') <> 'sys_home_callout'
      AND lower(COALESCE(json_extract(j.value, '$.title'), '')) <> lower('Cổng dịch vụ công và dữ liệu xác thực trực tuyến')
      AND lower(COALESCE(json_extract(j.value, '$.text'), '')) NOT LIKE '%cơ sở dữ liệu d1 đã kiểm duyệt%'
  ), '[]'),
  blocks_en_json = COALESCE((
    SELECT json_group_array(json(j.value))
    FROM json_each(CASE WHEN json_valid(cms_pages.blocks_en_json) THEN cms_pages.blocks_en_json ELSE '[]' END) AS j
    WHERE COALESCE(json_extract(j.value, '$.id'), '') <> 'sys_home_callout'
      AND lower(COALESCE(json_extract(j.value, '$.title'), '')) <> lower('Online Digital Services & Verified Data Portal')
      AND lower(COALESCE(json_extract(j.value, '$.text'), '')) NOT LIKE '%verified d1 database records%'
  ), '[]')
WHERE id = 'sys_home' AND route_path = '/';
