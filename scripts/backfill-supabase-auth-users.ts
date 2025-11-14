import { config as loadEnv } from 'dotenv';
import { createClient, type User } from '@supabase/supabase-js';

loadEnv({ path: '.env.local', override: true });
loadEnv();

const DEFAULT_PASSWORD = 'mtjin5054!';
const PAGE_SIZE = 1000;

type DbUser = {
  id: string;
  email: string | null;
  name: string | null;
  auth_user_id: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`환경 변수 ${key}가 설정되어 있지 않습니다.`);
  }
  return value;
}

function isValidUUID(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

async function loadAllSupabaseUsersMap(adminClient: ReturnType<typeof createClient>) {
  const map = new Map<string, User>();
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Supabase 사용자 목록 조회 실패 (page ${page}): ${error.message}`);
    }

    const batch = data?.users ?? [];

    batch.forEach((user) => {
      if (user.email) {
        map.set(user.email.toLowerCase(), user);
      }
    });

    if (batch.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return map;
}

async function main() {
  const supabaseUrl = assertEnv(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const serviceRoleKey = assertEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SERVICE_ROLE_KEY'
  );

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: dbUserRows, error: dbError } = await supabaseAdmin
    .from<DbUser>('users')
    .select('id, email, name, auth_user_id')
    .is('deleted_at', null)
    .limit(10000);

  if (dbError || !dbUserRows) {
    throw new Error(`사용자 목록을 불러오지 못했습니다: ${dbError?.message}`);
  }

  console.log(`총 ${dbUserRows.length}명의 앱 사용자를 처리합니다.`);

  const supabaseUsersByEmail = await loadAllSupabaseUsersMap(supabaseAdmin);

  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const user of dbUserRows) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      summary.skipped += 1;
      console.warn(`[SKIP] 사용자 ${user.id}는 이메일이 없어 건너뜁니다.`);
      continue;
    }

    const name = user.name?.trim() || 'ShiftEasy User';
    let supabaseUser = supabaseUsersByEmail.get(email);

    if (!supabaseUser && isValidUUID(user.auth_user_id)) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        user.auth_user_id
      );

      if (!error && data?.user) {
        supabaseUser = data.user;
        if (supabaseUser.email) {
          supabaseUsersByEmail.set(supabaseUser.email.toLowerCase(), supabaseUser);
        }
      }
    }

    try {
      if (supabaseUser) {
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(supabaseUser.id, {
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: {
              name,
              appUserId: user.id,
            },
          });

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (user.auth_user_id !== supabaseUser.id) {
          const { error: updateMappingError } = await supabaseAdmin
            .from('users')
            .update({
              auth_user_id: supabaseUser.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (updateMappingError) {
            throw new Error(`DB 업데이트 실패: ${updateMappingError.message}`);
          }
        }

        summary.updated += 1;
        console.log(`[UPDATE] ${email} → Supabase 사용자 ${supabaseUser.id}`);
        continue;
      }

      const { data: created, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            name,
            appUserId: user.id,
          },
        });

      if (createError || !created?.user) {
        throw new Error(createError?.message || '알 수 없는 오류');
      }

      const { error: updateMappingError } = await supabaseAdmin
        .from('users')
        .update({
          auth_user_id: created.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateMappingError) {
        throw new Error(`DB 업데이트 실패: ${updateMappingError.message}`);
      }

      supabaseUsersByEmail.set(email, created.user);
      summary.created += 1;
      console.log(`[CREATE] ${email} → Supabase 사용자 ${created.user.id}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[FAIL] ${email}:`, error);
    }
  }

  console.log('\n=== Supabase 계정 백필 결과 ===');
  console.table(summary);
}

main().catch((error) => {
  console.error('백필 작업 중 오류가 발생했습니다:', error);
  process.exit(1);
});
