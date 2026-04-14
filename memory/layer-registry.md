# Layer Registry — 33 Layers, 245 Modules

## L01 · Foundation (modules 1–12)
Core hierarchy every other layer depends on.
```
1.  Exam Category       2.  Exam Board          3.  Exam Pattern
4.  Exam                5.  Stream              6.  Class Level
7.  Subject             8.  Chapter             9.  Topic
10. Subtopic            11. Syllabus            12. Difficulty Level
```

## L02 · Content (modules 13–35)
All learnable and testable content.
```
13. Question Bank       14. Answer + Solution   15. Solution Video
16. Concept Video       17. Shortcut + Tricks   18. Common Mistakes
19. Related Questions   20. Question Discussion 21. Expert Explanation
22. Multilingual Support 23. Difficulty Calibrator 24. Notes
25. Formula Sheet       26. Mind Map            27. Previous Year Paper
28. Practice Set        29. Mock Test           30. Section Test
31. Mini Test           32. Custom Test         33. Board Exam Paper
34. Olympiad Module     35. Interview Prep
```

## L03 · Bundle (modules 36–39)
Packages content for offline delivery.
```
36. Bundle Builder      37. Bundle Manifest     38. Bundle Delivery
39. Bundle Access
```

## L04 · Auth + Access (modules 40–43)
Identity, JWT lifecycle, subscription gating, enrollment, RBAC.
```
40. Auth                41. Subscription        42. Enrollment
43. Role Manager
```

## L05 · Onboarding (modules 44–49)
First-time student experience.
```
44. Student Onboarding Wizard   45. Goal Setter         46. Initial Diagnostic
47. Personalisation Engine      48. Tour Guide          49. Device Setup
```

## L06 · User (modules 50–52)
Student identity and device management.
```
50. Profile             51. Settings            52. Device Manager
```

## L07 · Study Planner (modules 53–58)
Auto-generated plans based on exam date, weak areas, available time.
```
53. Daily Study Plan    54. Weekly Revision Plan  55. Exam Countdown
56. Study Session Tracker 57. Break Reminder     58. Study Streak
```

## L08 · Test Engine (modules 59–63)
Loads bundles offline, runs timed tests, evaluates, tracks attempts.
```
59. Test Loader         60. Test Runner         61. Answer Evaluator
62. Attempt Tracker     63. Test Pauser
```

## L09 · Assessment (modules 64–69)
Advanced evaluation beyond standard tests.
```
64. Diagnostic Test     65. Adaptive Test       66. Proctoring
67. OMR Simulator       68. Subjective Answer   69. Peer Review
```

## L10 · Results + Analysis (modules 70–80)
Stores every attempt immutably. Scores, weakness, trends, percentiles.
```
70. Results Store       71. Score Calculator    72. Time Analyzer
73. Accuracy Tracker    74. Weakness Engine     75. Revision Engine
76. Trend Analyzer      77. Comparison Engine   78. Percentile Engine
79. Cut-off Tracker     80. Board Score Predictor
```

## L11 · Analytics — Student-Facing (modules 81–88)
Personal analytics visible to student.
```
81. Personal Analytics Dashboard  82. Study Time Analytics  83. Question Analytics
84. Video Analytics               85. Improvement Score     86. Weak Area Heatmap
87. Strong Area Map               88. Peer Comparison
```

## L12 · Engagement (modules 89–94)
Motivation and retention mechanics.
```
89. Leaderboard         90. Badges              91. Streaks
92. Goals               93. Reminders           94. Feedback
```

## L13 · Social (modules 95–99)
Community and peer learning.
```
95. Study Group         96. Group Challenge     97. Discussion Forum
98. Student Blog        99. Achievement Share
```

## L14 · Communication (modules 100–104)
Structured communication between students, teachers, admins.
```
100. Announcement       101. Doubt Engine       102. Doubt Assignment
103. Chat               104. Notice Board
```

## L15 · Content Creation (modules 105–108)
Teacher-side tools to create and assemble content.
```
105. Question Creator   106. Test Creator       107. Notes Creator
108. Paper Generator
```

## L16 · Quality Control (modules 109–114)
End-to-end content quality pipeline.
```
109. Question Review Workflow  110. Answer Verification  111. Duplicate Detector
112. Difficulty Validator      113. Content Moderator    114. Video Verifier
```

## L17 · Live (modules 115–120)
Scheduled live classes and live tests.
```
115. Live Class         116. Live Test          117. Recording Manager
118. Live Attendance    119. Whiteboard         120. Live Leaderboard
```

## L18 · Mentorship (modules 121–125)
1-on-1 student-mentor relationship.
```
121. Mentor Assignment  122. Session Booking    123. Mentor Notes
124. Mentorship Progress  125. Mentor Rating
```

## L19 · Reports (modules 126–132)
Structured reporting for all stakeholders.
```
126. Report Card        127. Progress Report    128. Parent View
129. Teacher View       130. Topper Analysis    131. Board Readiness
132. Competitive Readiness
```

## L20 · Notifications (modules 133–136)
Multi-channel notification system.
```
133. Notification Engine  134. Push Notification  135. In-App Alert
136. Exam Calendar
```

## L21 · Payment (modules 137–142)
India-first payment infrastructure.
```
137. Payment Gateway    138. Invoice Generator  139. Refund Manager
140. EMI Manager        141. Wallet             142. Tax Manager
```

## L22 · Marketplace (modules 143–147)
Course discovery and purchase outside subscription.
```
143. Course Catalog     144. Course Purchase    145. Coupon Manager
146. Referral Engine    147. Affiliate Manager
```

## L23 · Career (modules 148–152)
Post-exam career guidance.
```
148. Career Guidance    149. College Predictor  150. Cut-off Predictor
151. Scholarship Finder 152. Job Board
```

## L24 · Interview (modules 153–157)
Preparation beyond written exams.
```
153. Interview Question Bank  154. Mock Interview Engine  155. GD Simulator
156. Resume Builder           157. Personality Assessment
```

## L25 · Integration (modules 158–167)
External service connectors.
```
158. Google Classroom Sync   159. Microsoft Teams Sync  160. Zoom / Google Meet
161. WhatsApp Notification   162. SMS Gateway           163. Email Engine
164. YouTube API Sync        165. DigiLocker            166. Aadhaar eKYC
167. UPI Deep Link
```

## L26 · Sync + Offline (modules 168–171)
Client-side sync and offline reliability.
```
168. Sync Engine        169. Offline Engine     170. Conflict Resolver
171. Bundle Cache
```

## L27 · Video Layer (modules 172–176)
YouTube-based video infrastructure.
```
172. Video Map Admin    173. Video Player       174. Video Progress
175. Video Recommendation  176. Video Feedback
```

## L28 · Admin (modules 177–188)
Central management for all platform config.
```
177. Tenant Admin       178. Question Admin     179. Exam Admin
180. Syllabus Admin     181. Bundle Admin       182. Content Admin
183. Video Admin        184. Subscription Admin 185. Cut-off Admin
186. School/College Config Admin  187. Institution Config Admin  188. Migration Admin
```

## L29 · School Layer (modules 189–201)
School-specific modules for Class 1–12.
```
189. School Board Manager    190. Class Manager           191. School Subject Manager
192. School Syllabus Tracker 193. School Timetable        194. School Exam Planner
195. Homework Module         196. Class Test Engine       197. School Report Card
198. Attendance Tracker      199. Parent Portal           200. Teacher Portal
201. Board Exam Readiness
```

## L30 · College Layer (modules 202–214)
College and degree-specific modules.
```
202. College Department Manager  203. Semester Manager       204. College Subject Manager
205. College Syllabus Tracker    206. College Exam Planner   207. Assignment Module
208. College Test Engine         209. Internal Marks Manager 210. College Report Card
211. College Attendance Tracker  212. College Parent Portal  213. Faculty Portal
214. University Exam Readiness
```

## L31 · Institution Layer (modules 215–224)
Coaching institute and tuition center modules.
```
215. Batch Manager              216. Institute Course Manager  217. Institute Timetable
218. Fee Manager                219. Institute Test Engine     220. Student Progress Dashboard
221. Institute Report Card      222. Institute Attendance Tracker  223. Counselor Portal
224. Institute Performance Analytics
```

## L32 · Competitive Layer (modules 225–239)
RRB, SSC, UPSC, Banking, State PSC, Defence exams.
```
225. Competitive Exam Manager   226. Cut-off Manager          227. Attempt Strategy Planner
228. Subject Prioritizer        229. Daily Target Planner     230. Current Affairs Module
231. GK Module                  232. Newspaper Summary Module 233. Speed + Accuracy Trainer
234. Sectional Time Manager     235. Previous Year Analysis   236. State PSC Manager
237. Language Paper Manager     238. Descriptive Answer Module  239. Interview Prep Module (competitive)
```

## L33 · Observability (modules 240–245)
Platform-wide monitoring — absolute last layer.
```
240. Edge Metrics       241. Lambda Metrics     242. DB Metrics
243. Cost Monitor       244. Alert Engine       245. Audit Log
```

---

## Summary Table

| # | Layer | Modules |
|---|---|---|
| L01 | Foundation | 12 |
| L02 | Content | 23 |
| L03 | Bundle | 4 |
| L04 | Auth + Access | 4 |
| L05 | Onboarding | 6 |
| L06 | User | 3 |
| L07 | Study Planner | 6 |
| L08 | Test Engine | 5 |
| L09 | Assessment | 6 |
| L10 | Results + Analysis | 11 |
| L11 | Analytics | 8 |
| L12 | Engagement | 6 |
| L13 | Social | 5 |
| L14 | Communication | 5 |
| L15 | Content Creation | 4 |
| L16 | Quality Control | 6 |
| L17 | Live | 6 |
| L18 | Mentorship | 5 |
| L19 | Reports | 7 |
| L20 | Notifications | 4 |
| L21 | Payment | 6 |
| L22 | Marketplace | 5 |
| L23 | Career | 5 |
| L24 | Interview | 5 |
| L25 | Integration | 10 |
| L26 | Sync + Offline | 4 |
| L27 | Video Layer | 5 |
| L28 | Admin | 12 |
| L29 | School Layer | 13 |
| L30 | College Layer | 13 |
| L31 | Institution Layer | 10 |
| L32 | Competitive Layer | 15 |
| L33 | Observability | 6 |
| | **Total** | **245** |
