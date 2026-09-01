-- Повторная оценка дня должна сдвигать метку времени: по ней UI решает,
-- изменился ли план после последней оценки (кнопка «Обновить оценку»)
ALTER TABLE "evaluations" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
