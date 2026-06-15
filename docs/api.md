# API Reference

Base URL: `http://localhost:3001` (dev) | Autenticação via cookie de sessão Better Auth.

## Auth — Better Auth (`/api/auth/*`)

Gerenciado pelo Better Auth. Principais endpoints:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/sign-up/email` | Registrar com email+senha |
| POST | `/api/auth/sign-in/email` | Login com email+senha |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/session` | Sessão atual |
| POST | `/api/auth/sign-in/social` | OAuth (Google) |

## Health

```
GET /health
→ { status: "ok", timestamp: "..." }
```

## Transações

### Listar
```
GET /api/transactions
Query params:
  page        number  (default: 1)
  limit       number  (default: 20, max: 100)
  type        "income" | "expense" | "transfer"
  categoryId  string
  accountId   string
  startDate   string  (YYYY-MM-DD)
  endDate     string  (YYYY-MM-DD)
  search      string  (busca em description)
  isIgnored   boolean

→ {
    data: Transaction[],
    meta: { page, limit, total, totalPages }
  }
```

### Criar
```
POST /api/transactions
Body: {
  type: "income" | "expense" | "transfer",
  amount: number,               // positivo, ex: 50.00
  description: string,
  date: string,                 // YYYY-MM-DD
  accountId: string,
  categoryId?: string,
  notes?: string,
  isIgnored?: boolean           // default: false
}
→ Transaction
```

### Atualizar
```
PATCH /api/transactions/:id
Body: Partial<CreateTransaction>
→ Transaction
```

### Deletar
```
DELETE /api/transactions/:id
→ { success: true }
```

### Relatório Mensal
```
GET /api/transactions/reports/monthly?year=2025&month=6
→ {
    income: number,
    expense: number,
    balance: number,
    byCategory: [
      { categoryId, name, icon, color, total, count }
    ]  // top 10 por gasto
  }
```

## Contas Financeiras

```
GET    /api/accounts
POST   /api/accounts   { name, type, institution?, color?, currency? }
PATCH  /api/accounts/:id
DELETE /api/accounts/:id   (soft delete via isArchived)
```

Tipos: `checking` | `savings` | `credit_card` | `investment` | `wallet`

## Categorias

```
GET /api/categories?type=expense   → categorias hierárquicas com children[]
GET /api/categories?type=income    → categorias de receita
POST   /api/categories   { name, type, icon?, color?, parentId? }
PATCH  /api/categories/:id
DELETE /api/categories/:id         (somente categorias do usuário, não sistema)
```

## Orçamentos

```
GET /api/budgets?year=2025&month=6
→ Budget[] com campos extras: spentAmount, percentage, isOverBudget, isNearLimit

POST /api/budgets {
  name: string,
  amount: number,
  period: "weekly" | "monthly" | "yearly",
  categoryId?: string,
  startDate: string,
  endDate?: string,
  alertThreshold?: number   // default: 0.80
}

PATCH  /api/budgets/:id
DELETE /api/budgets/:id
```

## Bots

```
POST /api/bots/telegram   Webhook do Telegram (grammy)
```

## Tipos principais

```typescript
type Transaction = {
  id: string
  type: "income" | "expense" | "transfer"
  amount: string          // Decimal serializado como string
  description: string
  date: string            // ISO 8601
  notes: string | null
  isIgnored: boolean
  source: "manual" | "open_finance" | "telegram" | "whatsapp" | "import"
  category: { id: string; name: string; icon: string | null; color: string | null } | null
  account: { id: string; name: string; institution: string | null; color: string | null }
  createdAt: string
}

type Budget = {
  id: string
  name: string
  amount: string
  period: string
  alertThreshold: string
  category: { id: string; name: string; icon: string | null } | null
  // Campos calculados:
  spentAmount: number
  percentage: number
  isOverBudget: boolean
  isNearLimit: boolean
}
```
