// O Supabase devolve no máximo 1000 linhas por pedido. Esta função lê a tabela
// toda, em blocos, para nada ficar de fora (ex.: presenças de toda a época).
//   buildQuery: () => supabase.from('tabela').select('*').order(...)
export async function fetchAllRows(buildQuery, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

// Datas podem vir como '2026-11-06' ou '2026-11-06T00:00:00+00:00', conforme o tipo da coluna
export const dayKey = (value) => String(value ?? '').slice(0, 10);
