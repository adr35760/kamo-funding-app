import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});
for (const t of ['email_logs','registrations']) {
  const { error, count } = await s.from(t).select('*',{count:'exact',head:true});
  console.log(t, error ? `ERR ${error.code} ${error.message}` : `OK 件数=${count}`);
}
// registrations に既にメール状態列があるか（1行取って列名を見る）
const { data } = await s.from('registrations').select('*').limit(1);
console.log('registrations の列:', data?.[0] ? Object.keys(data[0]).join(', ') : '(0件)');
