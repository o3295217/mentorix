# Статус проекта

> ⚠️ Этот файл генерируется автоматически при коммите. Не редактируй вручную!
> 
> Последнее обновление: **2026-05-04**

## Общая информация

- **Название:** ai-assistant-spec
- **Версия:** 1.0.0
- **Фреймворк:** Next.js
- **База данных:** PostgreSQL + Prisma

## Страницы (17)

| Путь |
|------|
| `/forgot-password` |
| `/login` |
| `/register` |
| `/reset-password` |
| `/verify-email` |
| `/analytics` |
| `/daily` |
| `/evaluation/[date]` |
| `/forecast` |
| `/goals` |
| `/history` |
| `/onboarding` |
| `/periods` |
| `/periods/[id]` |
| `/profile` |
| `/progress` |
| `/tasks` |

## API Endpoints (53)

| Endpoint | Методы |
|----------|--------|
| `/api/analytics/ai-usage` | GET |
| `/api/analytics/trend` | GET |
| `/api/auth/forgot-password` | POST |
| `/api/auth/login` | POST |
| `/api/auth/logout` | POST |
| `/api/auth/me` | GET, PUT |
| `/api/auth/onboarding` | GET, POST |
| `/api/auth/register` | POST |
| `/api/auth/resend-verification` | POST |
| `/api/auth/reset-password` | GET, POST |
| `/api/auth/verify-email` | GET, POST |
| `/api/chat` | GET, POST, DELETE |
| `/api/daily` | GET, POST |
| `/api/daily/chat` | POST |
| `/api/daily/chat/messages` | GET, POST, DELETE |
| `/api/daily/check-plan` | POST |
| `/api/daily/indicators` | GET |
| `/api/evaluate` | POST |
| `/api/evaluate/batch` | GET, POST |
| `/api/evaluate-period` | POST |
| `/api/facts` | GET |
| `/api/facts/summary` | GET |
| `/api/forecast` | POST |
| `/api/goals/context` | GET |
| `/api/goals/decompose` | POST |
| `/api/goals/dream` | GET, POST |
| `/api/goals/items` | GET, POST, PUT, DELETE |
| `/api/goals/move` | POST |
| `/api/goals/period` | GET, POST |
| `/api/goals/planning-profile` | GET, POST |
| `/api/goals/tags` | GET, POST, DELETE |
| `/api/goals/year` | GET, POST |
| `/api/goals/year-evaluations` | GET |
| `/api/habits` | GET, POST, PUT, DELETE |
| `/api/habits/suggestions` | GET |
| `/api/health` | GET |
| `/api/periods` | GET |
| `/api/periods/[id]` | GET |
| `/api/profile` | GET, POST |
| `/api/profile/blocks` | GET, POST, DELETE, PATCH |
| `/api/profile/categories` | GET, POST, DELETE, PATCH |
| `/api/profile/insights` | GET, PUT |
| `/api/profile/items` | POST, DELETE, PATCH |
| `/api/profile/theme` | GET, POST |
| `/api/progress` | GET |
| `/api/tasks/[id]` | PATCH |
| `/api/tasks/[id]/close` | POST |
| `/api/tasks/[id]/delete` | DELETE |
| `/api/tasks/[id]/reopen` | POST |
| `/api/tasks/add-suggested` | POST |
| `/api/tasks/closed` | GET |
| `/api/tasks/open` | GET, POST |
| `/api/tasks/process-uncompleted` | POST |

## Компоненты (32)

- `AuthGuard`
- `AuthProvider`
- `DatePickerWithIndicators`
- `DreamProgress`
- `ExpandableInput`
- `Landing`
- `LayoutFooter`
- `Navigation`
- `ProgressIndicator`
- `Providers`
- `Speedometer`
- `ThemeProvider`
- `UncompletedTasksModal`
- `goals/DreamBar`
- `goals/GoalsChatPanel`
- `goals/GoalsChatTrigger`
- `goals/MonthSection`
- `goals/MonthTimeline`
- `goals/PeriodView`
- `goals/StrategyCards`
- `goals/WeekCard`
- `landing/CtaSection`
- `landing/DayFlowSection`
- `landing/DreamSection`
- `landing/EvaluationSection`
- `landing/FooterSection`
- `landing/HeroSection`
- `landing/PainSection`
- `landing/ToolVisual`
- `landing/ToolsSection`
- `landing/TrustSection`
- `landing/data`

## Модели БД (28)

### User
| Поле | Тип |
|------|-----|
| id | `String` |
| email | `String` |
| name | `String?` |
| passwordHash | `String` |
| role | `String` |
| isActive | `Boolean` |
| emailVerified | `Boolean` |
| onboardingCompleted | `Boolean` |
| themePreference | `ThemePreference` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |
| lastLoginAt | `DateTime?` |
| deletedAt | `DateTime?` |
| dreamGoals | `DreamGoal[]` |
| yearGoals | `YearGoal[]` |
| periodGoals | `PeriodGoal[]` |
| goals | `Goal[]` |
| goalTags | `GoalTag[]` |
| dailyEntries | `DailyEntry[]` |
| openTasks | `OpenTask[]` |
| profile | `UserProfile?` |
| profileBlocks | `ProfileBlock[]` |
| habits | `Habit[]` |
| insights | `UserInsights?` |
| insightEntries | `InsightEntry[]` |
| stats | `UserStats?` |
| periodEvaluations | `PeriodEvaluation[]` |
| worldContexts | `WorldContext[]` |
| sessions | `Session[]` |
| passwordResetTokens | `PasswordResetToken[]` |
| emailVerificationTokens | `EmailVerificationToken[]` |
| chatMessages | `ChatMessage[]` |
| completedWork | `CompletedWork[]` |
| workSummaries | `WorkSummary[]` |
| planningProfile | `PlanningProfile?` |

### Session
| Поле | Тип |
|------|-----|
| id | `String` |
| userId | `String` |
| user | `User` |
| token | `String` |
| expiresAt | `DateTime` |
| userAgent | `String?` |
| ipAddress | `String?` |
| createdAt | `DateTime` |

### DreamGoal
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| goalText | `String` |
| months | `Int?` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### YearGoal
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| year | `Int` |
| goalsJson | `Json` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### PeriodGoal
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| periodType | `String` |
| periodStart | `DateTime` |
| periodEnd | `DateTime` |
| goalsJson | `Json` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### Goal
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| text | `String` |
| periodType | `String` |
| periodKey | `String` |
| completed | `Boolean` |
| completedAt | `DateTime?` |
| deadline | `DateTime?` |
| priority | `String` |
| tagsJson | `Json` |
| blockedByJson | `Json` |
| historyJson | `Json` |
| sortOrder | `Int` |
| scope | `String?` |
| rootYearGoalId | `String?` |
| parentId | `Int?` |
| parent | `Goal?` |
| children | `Goal[]` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### GoalTag
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| name | `String` |
| color | `String` |
| createdAt | `DateTime` |

### DailyEntry
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| date | `DateTime` |
| planText | `String?` |
| factText | `String?` |
| planSnapshotJson | `Json?` |
| extraTasksJson | `Json` |
| emotionalState | `String?` |
| physicalState | `String?` |
| lifeEvents | `String?` |
| externalFactors | `String?` |
| energyLevel | `Int?` |
| sleepQuality | `Int?` |
| familyTime | `Int?` |
| exerciseTime | `Int?` |
| selectedTasksJson | `Json?` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |
| evaluation | `Evaluation?` |

### Evaluation
| Поле | Тип |
|------|-----|
| id | `Int` |
| dailyEntryId | `Int` |
| dailyEntry | `DailyEntry` |
| dreamProgressScore | `Int` |
| strategicFocusScore | `Int` |
| productivityScore | `Int` |
| lifeBalanceScore | `Int` |
| disciplineScore | `Int` |
| overallScore | `Float` |
| feedbackText | `String` |
| planVsFactText | `String` |
| alignmentDayWeek | `String` |
| alignmentWeekMonth | `String` |
| alignmentMonthQuarter | `String` |
| alignmentQuarterHalf | `String` |
| alignmentHalfYear | `String` |
| alignmentYearDream | `String` |
| healthFlag | `String?` |
| familyFlag | `String?` |
| energyFlag | `String?` |
| workHealthAlignment | `String?` |
| workFamilyAlignment | `String?` |
| workValuesAlignment | `String?` |
| recommendationsText | `String` |
| suggestedTasksJson | `Json?` |
| createdAt | `DateTime` |

### OpenTask
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| taskText | `String` |
| taskType | `String` |
| originDate | `DateTime` |
| isClosed | `Boolean` |
| archiveStatus | `String?` |
| closedAt | `DateTime?` |
| createdAt | `DateTime` |

### UserProfile
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| name | `String?` |
| occupation | `String?` |
| industry | `String?` |
| maritalStatus | `String?` |
| hobbies | `String?` |
| sports | `String?` |
| location | `String?` |
| age | `Int?` |
| customInterests | `String?` |
| education | `String?` |
| teamSize | `Int?` |
| workExperience | `String?` |
| values | `String?` |
| challenges | `String?` |
| other | `String?` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### ProfileBlock
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| title | `String` |
| order | `Int` |
| categories | `ProfileCategory[]` |
| items | `ProfileItem[]` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### ProfileCategory
| Поле | Тип |
|------|-----|
| id | `Int` |
| blockId | `Int` |
| block | `ProfileBlock` |
| title | `String` |
| order | `Int` |
| items | `ProfileItem[]` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### ProfileItem
| Поле | Тип |
|------|-----|
| id | `Int` |
| blockId | `Int?` |
| block | `ProfileBlock?` |
| categoryId | `Int?` |
| category | `ProfileCategory?` |
| fieldName | `String` |
| fieldValue | `String` |
| content | `String?` |
| order | `Int` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### Habit
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| taskText | `String` |
| frequency | `String` |
| daysOfWeek | `String?` |
| interval | `Int?` |
| isActive | `Boolean` |
| streak | `Int` |
| bestStreak | `Int` |
| totalDone | `Int` |
| sortOrder | `Int` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### PeriodEvaluation
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| periodType | `String` |
| periodStart | `DateTime` |
| periodEnd | `DateTime` |
| dreamProgressScore | `Float` |
| overallScore | `Float` |
| professionalBlock | `String` |
| personalBlock | `String` |
| socialBlock | `String` |
| balanceBlock | `String` |
| patterns | `String` |
| trends | `String` |
| goalsCompletion | `String` |
| alignment | `String` |
| blockers | `String?` |
| feedbackText | `String` |
| recommendationsText | `String` |
| insights | `String?` |
| createdAt | `DateTime` |

### WorldContext
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| date | `DateTime` |
| marketEvents | `String?` |
| personalEvents | `String?` |
| constraints | `String?` |
| notes | `String?` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### UserInsights
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| patterns | `String?` |
| strengths | `String?` |
| challenges | `String?` |
| preferences | `String?` |
| recommendations | `String?` |
| motivators | `String?` |
| weeklySummary | `String?` |
| evaluationCount | `Int` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### InsightEntry
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| date | `String` |
| category | `String` |
| text | `String` |
| score | `Float?` |
| createdAt | `DateTime` |

### UserStats
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| totalDays | `Int` |
| totalPlanned | `Int` |
| totalCompleted | `Int` |
| avgCompletionPct | `Float` |
| avgDailyScore | `Float` |
| completionByDayJson | `Json` |

### PasswordResetToken
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| token | `String` |
| expiresAt | `DateTime` |
| usedAt | `DateTime?` |
| createdAt | `DateTime` |

### EmailVerificationToken
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| token | `String` |
| expiresAt | `DateTime` |
| usedAt | `DateTime?` |
| createdAt | `DateTime` |

### CompletedWork
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| date | `DateTime` |
| type | `String` |
| text | `String` |
| category | `String?` |
| goalLink | `String?` |
| sourceType | `String?` |
| sourceId | `Int?` |
| createdAt | `DateTime` |

### WorkSummary
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| periodType | `String` |
| periodKey | `String` |
| summaryText | `String` |
| keyAchievements | `Json` |
| tasksCompleted | `Int` |
| goalsCompleted | `Int` |
| topCategoriesJson | `Json?` |

### ChatMessage
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| date | `String` |
| role | `String` |
| content | `String` |
| createdAt | `DateTime` |

### PlanningProfile
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| user | `User` |
| hoursPerWeek | `Int?` |
| experienceLevel | `String?` |
| hasBudget | `String?` |
| currentWorkload | `String?` |
| constraints | `String?` |
| declined | `Boolean` |
| createdAt | `DateTime` |
| updatedAt | `DateTime` |

### AuditLog
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String?` |
| action | `String` |
| resource | `String?` |
| resourceId | `String?` |
| details | `String?` |
| ipAddress | `String?` |
| userAgent | `String?` |
| createdAt | `DateTime` |

### AIUsage
| Поле | Тип |
|------|-----|
| id | `Int` |
| userId | `String` |
| endpoint | `String` |
| model | `String` |
| inputTokens | `Int` |
| outputTokens | `Int` |
| durationMs | `Int?` |
| success | `Boolean` |
| errorMessage | `String?` |
| createdAt | `DateTime` |


## Зависимости

### Production (10)
- @anthropic-ai/sdk
- @prisma/client
- bcrypt
- date-fns
- next
- nodemailer
- react
- react-dom
- recharts
- zod

### Development (19)
- @eslint/js
- @types/bcrypt
- @types/node
- @types/nodemailer
- @types/react
- @types/react-dom
- autoprefixer
- baseline-browser-mapping
- eslint
- eslint-config-next
- eslint-plugin-react-hooks
- husky
- lint-staged
- postcss
- prisma
- tailwindcss
- typescript
- typescript-eslint
- vitest
