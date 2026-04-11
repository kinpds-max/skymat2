-- ================================================
-- 하늘매트 Supabase 테이블 스키마
-- Supabase → SQL Editor에 붙여넣고 실행하세요
-- ================================================

-- 1. 시공 상담 신청
create table if not exists consultations (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamp with time zone default now(),
  name         text not null,
  phone        text not null,
  address      text not null,
  address_detail text,
  install_date text,
  area_type    text,
  sample_request text,
  sample_note  text,
  memo         text,
  calc_result  text
);

-- 2. 기업 협력 문의
create table if not exists business_inquiries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamp with time zone default now(),
  inquiry_type text not null,
  name         text not null,
  phone        text not null,
  email        text,
  message      text not null
);

-- RLS: 외부에서 insert만 허용 (읽기는 관리자만)
alter table consultations     enable row level security;
alter table business_inquiries enable row level security;

-- insert 허용 정책 (anon 포함 누구나 신청 가능)
create policy "allow_insert_consultations"
  on consultations for insert
  with check (true);

create policy "allow_insert_business_inquiries"
  on business_inquiries for insert
  with check (true);
