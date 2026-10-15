import { mockRoute } from '@/utils/http/mockRegistry'
import { loginMock, logoutMock } from './session'
import { allGoals, goalVersions, saveGoal } from './goals'
import { allWeekly, weeklyVersions, saveWeekly, recommendWeekly } from './weekly'
import { allReviews, saveReview, archiveReview, reviseReview } from './reviews'
import { beginAnalysis, finishAnalysis, materialSnapshot } from './analysis'
mockRoute('POST', '/prototype/personal/login', ({ data }) => loginMock(data.scenario))
mockRoute('POST', '/prototype/personal/logout', ({ data }) => logoutMock(data.fail))
mockRoute('GET', '/prototype/personal/goals', () => allGoals())
mockRoute('POST', '/prototype/personal/goals', ({ data }) => saveGoal(data.goal, data.scenario))
mockRoute('GET', '/prototype/personal/goal-versions', ({ params }) => goalVersions(params.id))
mockRoute('GET', '/prototype/personal/weekly', () => allWeekly())
mockRoute('GET', '/prototype/personal/reviews', () => allReviews())
mockRoute('POST', '/prototype/personal/reviews', ({ data }) =>
  saveReview(data.review, data.scenario)
)
mockRoute('POST', '/prototype/personal/analysis-start', ({ data }) =>
  beginAnalysis(data.year, data.quarter)
)
mockRoute('POST', '/prototype/personal/analysis-finish', ({ data }) =>
  finishAnalysis(data.id, data.scenario)
)
mockRoute('POST', '/prototype/personal/archive', ({ data }) =>
  archiveReview(data.id, data.version, data.fail)
)
mockRoute('POST', '/prototype/personal/revise', ({ data }) => reviseReview(data.id))
mockRoute('GET', '/prototype/personal/materials', ({ params }) =>
  materialSnapshot(params.year, params.quarter)
)
mockRoute('POST', '/prototype/personal/weekly', ({ data }) =>
  saveWeekly(data.report, data.scenario)
)
mockRoute('GET', '/prototype/personal/weekly-versions', ({ params }) => weeklyVersions(params.id))
mockRoute('POST', '/prototype/personal/recommend', ({ data }) =>
  recommendWeekly(data.id, data.version, data.scenario)
)
