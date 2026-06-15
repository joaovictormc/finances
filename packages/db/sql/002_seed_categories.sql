-- =============================================================================
-- Finances SaaS — Seed: Categorias do Sistema (BR)
--
-- Como executar (após 001_schema.sql):
--   psql -h 100.104.200.37 -U postgres -d finances -f 002_seed_categories.sql
--
-- Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente (pode rodar várias vezes).
-- IDs fixos com prefixo "system_" para distinguir de categorias do usuário.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GASTOS (expense)
-- -----------------------------------------------------------------------------

-- Alimentação
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_alimentação', 'Alimentação', '🍽️', '#f97316', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_alimentação_supermercado',   'Supermercado', '🛒', '#f97316', 'expense', true, 'system_alimentação', NOW()),
  ('system_alimentação_restaurante',    'Restaurante',  '🍴', '#f97316', 'expense', true, 'system_alimentação', NOW()),
  ('system_alimentação_lanche',         'Lanche',       '🥪', '#f97316', 'expense', true, 'system_alimentação', NOW()),
  ('system_alimentação_delivery',       'Delivery',     '🛵', '#f97316', 'expense', true, 'system_alimentação', NOW()),
  ('system_alimentação_padaria',        'Padaria',      '🥖', '#f97316', 'expense', true, 'system_alimentação', NOW())
ON CONFLICT (id) DO NOTHING;

-- Transporte
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_transporte', 'Transporte', '🚗', '#3b82f6', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_transporte_combustível',          'Combustível',       '⛽', '#3b82f6', 'expense', true, 'system_transporte', NOW()),
  ('system_transporte_uber/99',              'Uber/99',           '🚕', '#3b82f6', 'expense', true, 'system_transporte', NOW()),
  ('system_transporte_transporte_público',   'Transporte Público','🚌', '#3b82f6', 'expense', true, 'system_transporte', NOW()),
  ('system_transporte_estacionamento',       'Estacionamento',    '🅿️', '#3b82f6', 'expense', true, 'system_transporte', NOW()),
  ('system_transporte_manutenção_veículo',   'Manutenção Veículo','🔧', '#3b82f6', 'expense', true, 'system_transporte', NOW())
ON CONFLICT (id) DO NOTHING;

-- Moradia
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_moradia', 'Moradia', '🏠', '#8b5cf6', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_moradia_aluguel',              'Aluguel',            '🏘️', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_condomínio',           'Condomínio',         '🏢', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_energia_elétrica',     'Energia Elétrica',   '⚡', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_água_e_saneamento',    'Água e Saneamento',  '💧', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_internet',             'Internet',           '🌐', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_telefone',             'Telefone',           '📱', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_gás',                  'Gás',                '🔥', '#8b5cf6', 'expense', true, 'system_moradia', NOW()),
  ('system_moradia_reforma_e_manutenção', 'Reforma e Manutenção','🪛','#8b5cf6', 'expense', true, 'system_moradia', NOW())
ON CONFLICT (id) DO NOTHING;

-- Saúde
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_saúde', 'Saúde', '🏥', '#ef4444', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_saúde_plano_de_saúde', 'Plano de Saúde', '💊', '#ef4444', 'expense', true, 'system_saúde', NOW()),
  ('system_saúde_farmácia',       'Farmácia',       '💉', '#ef4444', 'expense', true, 'system_saúde', NOW()),
  ('system_saúde_consultas',      'Consultas',      '👨‍⚕️', '#ef4444', 'expense', true, 'system_saúde', NOW()),
  ('system_saúde_exames',         'Exames',         '🔬', '#ef4444', 'expense', true, 'system_saúde', NOW()),
  ('system_saúde_academia',       'Academia',       '🏋️', '#ef4444', 'expense', true, 'system_saúde', NOW())
ON CONFLICT (id) DO NOTHING;

-- Educação
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_educação', 'Educação', '📚', '#06b6d4', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_educação_faculdade/escola',     'Faculdade/Escola',      '🎓', '#06b6d4', 'expense', true, 'system_educação', NOW()),
  ('system_educação_cursos_e_treinamentos','Cursos e Treinamentos', '💻', '#06b6d4', 'expense', true, 'system_educação', NOW()),
  ('system_educação_livros_e_material',    'Livros e Material',     '📖', '#06b6d4', 'expense', true, 'system_educação', NOW())
ON CONFLICT (id) DO NOTHING;

-- Lazer
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_lazer', 'Lazer', '🎉', '#ec4899', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_lazer_cinema_e_teatro', 'Cinema e Teatro', '🎬', '#ec4899', 'expense', true, 'system_lazer', NOW()),
  ('system_lazer_viagens',         'Viagens',         '✈️', '#ec4899', 'expense', true, 'system_lazer', NOW()),
  ('system_lazer_streaming',       'Streaming',       '📺', '#ec4899', 'expense', true, 'system_lazer', NOW()),
  ('system_lazer_jogos',           'Jogos',           '🎮', '#ec4899', 'expense', true, 'system_lazer', NOW()),
  ('system_lazer_esportes',        'Esportes',        '⚽', '#ec4899', 'expense', true, 'system_lazer', NOW()),
  ('system_lazer_bares_e_baladas', 'Bares e Baladas', '🍺', '#ec4899', 'expense', true, 'system_lazer', NOW())
ON CONFLICT (id) DO NOTHING;

-- Vestuário
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_vestuário', 'Vestuário', '👕', '#84cc16', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_vestuário_roupas',      'Roupas',      '👔', '#84cc16', 'expense', true, 'system_vestuário', NOW()),
  ('system_vestuário_calçados',    'Calçados',    '👟', '#84cc16', 'expense', true, 'system_vestuário', NOW()),
  ('system_vestuário_acessórios',  'Acessórios',  '👜', '#84cc16', 'expense', true, 'system_vestuário', NOW())
ON CONFLICT (id) DO NOTHING;

-- Finanças
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_finanças', 'Finanças', '💰', '#f59e0b', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_finanças_impostos_e_taxas',        'Impostos e Taxas',       '📋', '#f59e0b', 'expense', true, 'system_finanças', NOW()),
  ('system_finanças_seguros',                 'Seguros',                '🛡️', '#f59e0b', 'expense', true, 'system_finanças', NOW()),
  ('system_finanças_investimentos',           'Investimentos',          '📈', '#f59e0b', 'expense', true, 'system_finanças', NOW()),
  ('system_finanças_empréstimo/financiamento','Empréstimo/Financiamento','🏦', '#f59e0b', 'expense', true, 'system_finanças', NOW()),
  ('system_finanças_cartão_de_crédito',       'Cartão de Crédito',      '💳', '#f59e0b', 'expense', true, 'system_finanças', NOW())
ON CONFLICT (id) DO NOTHING;

-- Pet
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_pet', 'Pet', '🐾', '#a78bfa', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_pet_ração_e_petisco', 'Ração e Petisco', '🦴', '#a78bfa', 'expense', true, 'system_pet', NOW()),
  ('system_pet_veterinário',     'Veterinário',     '🩺', '#a78bfa', 'expense', true, 'system_pet', NOW()),
  ('system_pet_banho_e_tosa',    'Banho e Tosa',    '🛁', '#a78bfa', 'expense', true, 'system_pet', NOW())
ON CONFLICT (id) DO NOTHING;

-- Outros Gastos
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_outros_gastos', 'Outros Gastos', '📦', '#6b7280', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RECEITAS (income)
-- -----------------------------------------------------------------------------

-- Salário
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_salário', 'Salário', '💼', '#22c55e', 'income', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_salário_salário_fixo',  'Salário Fixo', '💼', '#22c55e', 'income', true, 'system_salário', NOW()),
  ('system_salário_13º_salário',   '13º Salário',  '🎁', '#22c55e', 'income', true, 'system_salário', NOW()),
  ('system_salário_férias',        'Férias',       '🏖️', '#22c55e', 'income', true, 'system_salário', NOW()),
  ('system_salário_hora_extra',    'Hora Extra',   '⏰', '#22c55e', 'income', true, 'system_salário', NOW())
ON CONFLICT (id) DO NOTHING;

-- Renda Extra
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_renda_extra', 'Renda Extra', '💡', '#10b981', 'income', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_renda_extra_freelance',         'Freelance',        '🖥️', '#10b981', 'income', true, 'system_renda_extra', NOW()),
  ('system_renda_extra_vendas',            'Vendas',           '🛍️', '#10b981', 'income', true, 'system_renda_extra', NOW()),
  ('system_renda_extra_aluguel_recebido',  'Aluguel Recebido', '🏠', '#10b981', 'income', true, 'system_renda_extra', NOW()),
  ('system_renda_extra_dividendos',        'Dividendos',       '📊', '#10b981', 'income', true, 'system_renda_extra', NOW())
ON CONFLICT (id) DO NOTHING;

-- Benefícios
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_benefícios', 'Benefícios', '🎯', '#14b8a6', 'income', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, type, "isSystem", "parentId", "createdAt") VALUES
  ('system_benefícios_vale_refeição',  'Vale Refeição',  '🍽️', '#14b8a6', 'income', true, 'system_benefícios', NOW()),
  ('system_benefícios_vale_transporte','Vale Transporte', '🚌', '#14b8a6', 'income', true, 'system_benefícios', NOW()),
  ('system_benefícios_bolsa/auxílio',  'Bolsa/Auxílio',  '🎓', '#14b8a6', 'income', true, 'system_benefícios', NOW())
ON CONFLICT (id) DO NOTHING;

-- Outras Receitas
INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_outras_receitas', 'Outras Receitas', '💚', '#4ade80', 'income', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- TRANSFERÊNCIAS
-- -----------------------------------------------------------------------------

INSERT INTO categories (id, name, icon, color, type, "isSystem", "createdAt")
VALUES ('system_transferência', 'Transferência', '↔️', '#94a3b8', 'transfer', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Verificar resultado
-- -----------------------------------------------------------------------------
-- SELECT type, COUNT(*) FROM categories WHERE "isSystem" = true GROUP BY type;
-- Esperado: expense=10 pais + ~42 filhos | income=4 pais + ~11 filhos | transfer=1
