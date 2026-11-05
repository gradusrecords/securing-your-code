-- A returned card goes back to the review queue when its owner edits it.
-- Admin reviews (status/review_comment only) never trigger this.
create function public.resubmit_returned_card() returns trigger language plpgsql as $$
begin
  if old.status = 'returned' and new.status = old.status
     and (to_jsonb(new) - 'status' - 'review_comment') is distinct from (to_jsonb(old) - 'status' - 'review_comment') then
    new.status := 'pending';
  end if;
  return new;
end;
$$;
create trigger model_profiles_resubmit
  before update on public.model_profiles
  for each row execute function public.resubmit_returned_card();
