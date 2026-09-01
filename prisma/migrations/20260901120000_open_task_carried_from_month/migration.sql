-- Задачи, пришедшие из незакрытых целей прошлого месяца, помнят месяц-источник ("YYYY-MM")
ALTER TABLE "open_tasks" ADD COLUMN "carriedFromMonth" TEXT;
