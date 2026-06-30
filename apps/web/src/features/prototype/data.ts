import type { ElementType } from "react";
import { AlertCircle, Building2, CheckCircle2, CheckSquare, Mail, RefreshCw, Shield, Users } from "lucide-react";

export const EMPLOYEES = [
  { id: 1, name: "أحمد محمد العلي", nameEn: "Ahmed Al-Ali", dept: "IT", deptEn: "IT", role: "manager", avatar: "أ", color: "bg-blue-500", email: "ahmed@company.com", status: "active" },
  { id: 2, name: "سارة خالد الفارسي", nameEn: "Sara Al-Farsi", dept: "الموارد البشرية", deptEn: "HR", role: "manager", avatar: "س", color: "bg-purple-500", email: "sara@company.com", status: "active" },
  { id: 3, name: "محمد عبدالله الحربي", nameEn: "Mohammed Al-Harbi", dept: "المبيعات", deptEn: "Sales", role: "employee", avatar: "م", color: "bg-green-500", email: "mohammed@company.com", status: "active" },
  { id: 4, name: "نورة سلطان العتيبي", nameEn: "Noura Al-Otaibi", dept: "المالية", deptEn: "Finance", role: "employee", avatar: "ن", color: "bg-pink-500", email: "noura@company.com", status: "active" },
  { id: 5, name: "خالد عمر الدوسري", nameEn: "Khalid Al-Dosari", dept: "التسويق", deptEn: "Marketing", role: "employee", avatar: "خ", color: "bg-orange-500", email: "khalid@company.com", status: "inactive" },
  { id: 6, name: "فاطمة علي الزهراني", nameEn: "Fatima Al-Zahrani", dept: "IT", deptEn: "IT", role: "employee", avatar: "ف", color: "bg-teal-500", email: "fatima@company.com", status: "active" },
  { id: 7, name: "عبدالرحمن يوسف النجار", nameEn: "Abdulrahman Al-Najjar", dept: "العمليات", deptEn: "Operations", role: "manager", avatar: "ع", color: "bg-indigo-500", email: "ar@company.com", status: "active" }
];

export const TASKS = [
  { id: 1, title: "تطوير واجهة المستخدم", titleEn: "Develop UI Interface", status: "inProgress", priority: "high", assignee: "أحمد", assigneeEn: "Ahmed", dueDate: "١٠/٠٧/٢٠٢٦", dueDateEn: "07/10/2026", dept: "IT", avatarColor: "bg-blue-500" },
  { id: 2, title: "مراجعة تقارير المبيعات", titleEn: "Review Sales Reports", status: "new", priority: "medium", assignee: "سارة", assigneeEn: "Sara", dueDate: "٠٥/٠٧/٢٠٢٦", dueDateEn: "07/05/2026", dept: "Sales", avatarColor: "bg-purple-500" },
  { id: 3, title: "تحديث نظام الرواتب", titleEn: "Update Payroll System", status: "assigned", priority: "critical", assignee: "نورة", assigneeEn: "Noura", dueDate: "٠٨/٠٧/٢٠٢٦", dueDateEn: "07/08/2026", dept: "Finance", avatarColor: "bg-pink-500" },
  { id: 4, title: "إعداد خطة التسويق", titleEn: "Prepare Marketing Plan", status: "inProgress", priority: "high", assignee: "خالد", assigneeEn: "Khalid", dueDate: "١٥/٠٧/٢٠٢٦", dueDateEn: "07/15/2026", dept: "Marketing", avatarColor: "bg-orange-500" },
  { id: 5, title: "صيانة الخوادم", titleEn: "Server Maintenance", status: "completed", priority: "medium", assignee: "فاطمة", assigneeEn: "Fatima", dueDate: "٣٠/٠٦/٢٠٢٦", dueDateEn: "06/30/2026", dept: "IT", avatarColor: "bg-teal-500" },
  { id: 6, title: "توظيف مطور جديد", titleEn: "Hire New Developer", status: "pending", priority: "low", assignee: "محمد", assigneeEn: "Mohammed", dueDate: "٢٠/٠٧/٢٠٢٦", dueDateEn: "07/20/2026", dept: "HR", avatarColor: "bg-green-500" },
  { id: 7, title: "مراجعة عقود الموردين", titleEn: "Review Supplier Contracts", status: "new", priority: "medium", assignee: "عبدالرحمن", assigneeEn: "Abdulrahman", dueDate: "١٢/٠٧/٢٠٢٦", dueDateEn: "07/12/2026", dept: "Operations", avatarColor: "bg-indigo-500" },
  { id: 8, title: "تدريب فريق المبيعات", titleEn: "Sales Team Training", status: "assigned", priority: "high", assignee: "سارة", assigneeEn: "Sara", dueDate: "١٨/٠٧/٢٠٢٦", dueDateEn: "07/18/2026", dept: "HR", avatarColor: "bg-purple-500" },
  { id: 9, title: "تحليل بيانات العملاء", titleEn: "Analyze Customer Data", status: "inProgress", priority: "critical", assignee: "أحمد", assigneeEn: "Ahmed", dueDate: "٠٧/٠٧/٢٠٢٦", dueDateEn: "07/07/2026", dept: "Sales", avatarColor: "bg-blue-500" },
  { id: 10, title: "إطلاق الحملة الإعلانية", titleEn: "Launch Ad Campaign", status: "cancelled", priority: "high", assignee: "خالد", assigneeEn: "Khalid", dueDate: "٢٥/٠٦/٢٠٢٦", dueDateEn: "06/25/2026", dept: "Marketing", avatarColor: "bg-orange-500" },
  { id: 11, title: "تحديث سياسة الأمان", titleEn: "Update Security Policy", status: "new", priority: "critical", assignee: "فاطمة", assigneeEn: "Fatima", dueDate: "٠١/٠٧/٢٠٢٦", dueDateEn: "07/01/2026", dept: "IT", avatarColor: "bg-teal-500" }
];

export const LEAVES = [
  { id: 1, employee: "محمد عبدالله الحربي", employeeEn: "Mohammed Al-Harbi", type: "سنوية", typeEn: "Annual", start: "٠١/٠٧/٢٠٢٦", end: "٠٧/٠٧/٢٠٢٦", days: 7, status: "pending", avatar: "م", color: "bg-green-500" },
  { id: 2, employee: "نورة سلطان العتيبي", employeeEn: "Noura Al-Otaibi", type: "مرضية", typeEn: "Sick", start: "٢٨/٠٦/٢٠٢٦", end: "٣٠/٠٦/٢٠٢٦", days: 3, status: "approved", avatar: "ن", color: "bg-pink-500" },
  { id: 3, employee: "فاطمة علي الزهراني", employeeEn: "Fatima Al-Zahrani", type: "طارئة", typeEn: "Emergency", start: "٢٧/٠٦/٢٠٢٦", end: "٢٧/٠٦/٢٠٢٦", days: 1, status: "approved", avatar: "ف", color: "bg-teal-500" },
  { id: 4, employee: "خالد عمر الدوسري", employeeEn: "Khalid Al-Dosari", type: "سنوية", typeEn: "Annual", start: "١٥/٠٧/٢٠٢٦", end: "٢٢/٠٧/٢٠٢٦", days: 8, status: "rejected", avatar: "خ", color: "bg-orange-500" },
  { id: 5, employee: "عبدالرحمن يوسف النجار", employeeEn: "Abdulrahman Al-Najjar", type: "سنوية", typeEn: "Annual", start: "٠١/٠٨/٢٠٢٦", end: "١٤/٠٨/٢٠٢٦", days: 14, status: "pending", avatar: "ع", color: "bg-indigo-500" }
];

export const EMAILS = [
  {
    id: 1, from: "أحمد محمد العلي", fromEn: "Ahmed Al-Ali", avatar: "أ", color: "bg-blue-500",
    fromEmail: "ahmed@company.com", subject: "تقرير أداء الفريق للربع الثاني", subjectEn: "Q2 Team Performance Report",
    preview: "السلام عليكم، أرفق لكم تقرير أداء الفريق للربع الثاني من العام الحالي.",
    time: "١٠:٣٠ ص", read: false, starred: true,
    body: "السلام عليكم ورحمة الله وبركاته،\n\nأرفق لكم تقرير أداء الفريق للربع الثاني. يُظهر التقرير تحسناً ملحوظاً في مستوى إنجاز المهام بنسبة ٢٣٪ مقارنة بالربع الأول.\n\nأبرز النتائج:\n• إنجاز ٨٧٪ من المهام في الوقت المحدد\n• انخفاض معدل التأخير بنسبة ١٥٪\n• تحسن التواصل بين الأقسام\n\nمع خالص التحيات،\nأحمد محمد العلي",
    bodyEn: "Dear Team,\n\nPlease find attached the Q2 team performance report. The report shows a notable 23% improvement in task completion compared to Q1.\n\nKey highlights:\n• 87% of tasks completed on time\n• 15% reduction in delay rate\n• Improved cross-department communication\n\nBest regards,\nAhmed Al-Ali"
  },
  {
    id: 2, from: "سارة خالد الفارسي", fromEn: "Sara Al-Farsi", avatar: "س", color: "bg-purple-500",
    fromEmail: "sara@company.com", subject: "طلب موافقة على ميزانية التدريب", subjectEn: "Training Budget Approval Request",
    preview: "المحترم، نرجو الموافقة على ميزانية التدريب المقترحة للربع القادم.",
    time: "أمس", read: true, starred: false,
    body: "المحترم،\n\nأرجو الاطلاع على الميزانية المقترحة لبرنامج التدريب للربع الثالث:\n\n• تدريب القيادة: ١٥,٠٠٠ ريال\n• تطوير المهارات التقنية: ٢٢,٠٠٠ ريال\n• ورش العمل الإبداعية: ٨,٠٠٠ ريال\n\nالمجموع: ٤٥,٠٠٠ ريال\n\nنأمل الموافقة لضمان تطوير كوادرنا البشرية.\n\nشكراً،\nسارة",
    bodyEn: "Dear Manager,\n\nPlease review the proposed training budget for Q3:\n\n• Leadership Training: SAR 15,000\n• Technical Skills Development: SAR 22,000\n• Creative Workshops: SAR 8,000\n\nTotal: SAR 45,000\n\nYour approval is needed to ensure our team's development.\n\nThank you,\nSara"
  },
  {
    id: 3, from: "محمد عبدالله الحربي", fromEn: "Mohammed Al-Harbi", avatar: "م", color: "bg-green-500",
    fromEmail: "mohammed@company.com", subject: "اجتماع الفريق الأسبوعي", subjectEn: "Weekly Team Meeting",
    preview: "نذكركم بموعد اجتماع الفريق الأسبوعي غداً الساعة التاسعة صباحاً.",
    time: "أمس", read: true, starred: false,
    body: "عزيزي الفريق،\n\nنذكركم بموعد اجتماعنا الأسبوعي:\n\nالموعد: الأحد القادم\nالساعة: ٩:٠٠ صباحاً\nقاعة الاجتماعات الرئيسية\n\nجدول الأعمال:\n١. مراجعة المهام الأسبوعية\n٢. تحديثات المشاريع\n٣. التخطيط للأسبوع القادم\n\nيرجى الحضور في الموعد المحدد.\n\nمحمد",
    bodyEn: "Dear Team,\n\nReminder of our weekly meeting:\n\nDate: Next Sunday\nTime: 9:00 AM\nMain Conference Room\n\nAgenda:\n1. Weekly task review\n2. Project updates\n3. Next week planning\n\nPlease attend on time.\n\nMohammed"
  }
];

export const COMPANIES = [
  { id: 1, name: "شركة التقنية المتقدمة", nameEn: "Advanced Tech Co.", employees: 145, activeUsers: 132, plan: "enterprise", status: "active", admin: "علي الأحمد", adminEn: "Ali Al-Ahmad" },
  { id: 2, name: "مجموعة الأعمال الرائدة", nameEn: "Leading Business Group", employees: 87, activeUsers: 79, plan: "professional", status: "active", admin: "هند الراشد", adminEn: "Hind Al-Rashid" },
  { id: 3, name: "شركة الخدمات الذكية", nameEn: "Smart Services Co.", employees: 34, activeUsers: 28, plan: "starter", status: "trial", admin: "فيصل الحربي", adminEn: "Faisal Al-Harbi" },
  { id: 4, name: "مؤسسة البناء والتطوير", nameEn: "Build & Dev Foundation", employees: 210, activeUsers: 198, plan: "enterprise", status: "active", admin: "منى العتيبي", adminEn: "Mona Al-Otaibi" }
];

export const ACTIVITIES: { id: number; user: string; userEn: string; action: string; actionEn: string; target: string; time: string; icon: ElementType; color: string }[] = [
  { id: 1, user: "أحمد", userEn: "Ahmed", action: "أضاف مهمة جديدة", actionEn: "added a new task", target: "\"تطوير واجهة المستخدم\"", time: "منذ ١٠ د", icon: CheckSquare, color: "text-blue-500" },
  { id: 2, user: "سارة", userEn: "Sara", action: "وافقت على طلب إجازة", actionEn: "approved leave for", target: "نورة العتيبي", time: "منذ ٢٥ د", icon: CheckCircle2, color: "text-green-500" },
  { id: 3, user: "محمد", userEn: "Mohammed", action: "أرسل رسالة إلى", actionEn: "sent email to", target: "فريق المبيعات", time: "منذ ساعة", icon: Mail, color: "text-purple-500" },
  { id: 4, user: "نورة", userEn: "Noura", action: "أكملت المهمة", actionEn: "completed task", target: "\"صيانة الخوادم\"", time: "منذ ٢ س", icon: CheckCircle2, color: "text-green-500" },
  { id: 5, user: "خالد", userEn: "Khalid", action: "أضاف موظفاً جديداً", actionEn: "added new employee", target: "فاطمة الزهراني", time: "منذ ٣ س", icon: Users, color: "text-orange-500" },
  { id: 6, user: "فاطمة", userEn: "Fatima", action: "حدّثت حالة المهمة", actionEn: "updated task status", target: "\"صيانة الخوادم\"", time: "منذ ٥ س", icon: RefreshCw, color: "text-blue-500" }
];

export const STATUS_CHART = [
  { name: "جديد", nameEn: "New", value: 3, fill: "#94A3B8" },
  { name: "مُعيَّن", nameEn: "Assigned", value: 2, fill: "#3B82F6" },
  { name: "قيد التنفيذ", nameEn: "In Progress", value: 3, fill: "#F59E0B" },
  { name: "معلق", nameEn: "Pending", value: 1, fill: "#8B5CF6" },
  { name: "مكتمل", nameEn: "Completed", value: 1, fill: "#22C55E" },
  { name: "ملغى", nameEn: "Cancelled", value: 1, fill: "#EF4444" }
];

export const DEPT_CHART = [
  { nameAr: "التقنية", name: "IT", tasks: 3, fill: "#2563EB" },
  { nameAr: "المبيعات", name: "Sales", tasks: 2, fill: "#22C55E" },
  { nameAr: "المالية", name: "Finance", tasks: 1, fill: "#F59E0B" },
  { nameAr: "التسويق", name: "Marketing", tasks: 2, fill: "#EF4444" },
  { nameAr: "الموارد", name: "HR", tasks: 2, fill: "#8B5CF6" },
  { nameAr: "العمليات", name: "Operations", tasks: 1, fill: "#EC4899" }
];

export const SUPER_STATS = [
  { labelAr: "إجمالي الشركات", labelEn: "Total Companies", v: "4", I: Building2, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  { labelAr: "إجمالي الموظفين", labelEn: "Total Employees", v: "476", I: Users, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  { labelAr: "باقة مؤسسة", labelEn: "Enterprise Plans", v: "2", I: Shield, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  { labelAr: "شركات تجريبية", labelEn: "Trial Companies", v: "1", I: AlertCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" }
];
