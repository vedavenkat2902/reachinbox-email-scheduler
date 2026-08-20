import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock3,
  LayoutDashboard,
  Menu,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import {
  getCurrentUser,
  getGoogleLoginUrl,
  getCampaigns,
  getScheduledEmails,
  createCampaign,
  createScheduledEmail,
  type User,

} from "./api";

type EmailStatus =
  | "SCHEDULED"
  | "PROCESSING"
  | "SENT"
  | "FAILED";

interface Email {
  id: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    try {
      const data = await getCurrentUser();

      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
    } finally {
      setLoadingUser(false);
    }
  }

  if (loadingUser) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <Dashboard user={user} />;
}

/* =========================================================
   LOGIN
========================================================= */

function LoginScreen() {
  function handleGoogleLogin() {
    window.location.href = getGoogleLoginUrl();
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-[#171923] lg:flex">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#171923]">
                <Send size={20} />
              </div>

              <div>
                <h1 className="text-lg font-bold text-white">
                  ReachInbox
                </h1>

                <p className="text-[11px] text-gray-400">
                  Email Scheduler
                </p>
              </div>
            </div>

            <div className="max-w-lg">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-violet-300">
                <Sparkles size={16} />
                SIMPLE EMAIL SCHEDULING
              </div>

              <h2 className="text-5xl font-bold leading-tight tracking-tight text-white xl:text-6xl">
                Reach the right people,
                <span className="text-violet-300">
                  {" "}
                  at the right time.
                </span>
              </h2>

              <p className="mt-6 max-w-md text-sm leading-6 text-gray-400">
                Schedule personalized email campaigns with
                controlled sending delays and hourly limits.
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Email scheduling made simple.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-12 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171923] text-white">
                <Send size={18} />
              </div>

              <div>
                <h1 className="text-lg font-bold">
                  ReachInbox
                </h1>

                <p className="text-[11px] text-gray-400">
                  Email Scheduler
                </p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-600">
                Welcome
              </p>

              <h2 className="text-3xl font-bold tracking-tight">
                Sign in to ReachInbox
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Connect your Google account to manage your
                email campaigns.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:shadow"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100" />

              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-300">
                Secure sign in
              </span>

              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="rounded-2xl bg-[#f8f7ff] p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm">
                  <Clock3 size={15} />
                </div>

                <p className="text-xs font-bold text-gray-700">
                  Built for controlled sending
                </p>
              </div>

              <p className="text-[11px] leading-5 text-gray-500">
                Manage scheduling, sending delays, and hourly
                limits from one simple dashboard.
              </p>
            </div>

            <p className="mt-8 text-center text-[10px] text-gray-400">
              By continuing, you agree to use ReachInbox
              responsibly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<
    "scheduled" | "sent"
  >("scheduled");

  const [showCompose, setShowCompose] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  useEffect(() => {
  loadDashboardData();

  const interval = setInterval(() => {
    loadDashboardData();
  }, 3000);

  return () => clearInterval(interval);
}, []);

  async function handleLogout() {
    try {
      await fetch("http://localhost:5000/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  }

  async function loadDashboardData() {
    try {
      setLoadingEmails(true);

      const campaignResponse = await getCampaigns();

      

      const allEmails: Email[] = [];

      for (const campaign of campaignResponse.campaigns) {
        const emailResponse =
          await getScheduledEmails(campaign.id);

        for (const email of emailResponse.emails) {
          allEmails.push({
            id: email.id,
            recipient: email.recipient,
            subject: campaign.subject,
            scheduledAt: email.scheduledAt,
            sentAt: email.sentAt,
            status: email.status,
          });
        }
      }

      setEmails(allEmails);
    } catch (error) {
      console.error(
        "Failed to load dashboard data:",
        error,
      );
    } finally {
      setLoadingEmails(false);
    }
  }

  const scheduledEmails = emails.filter(
    (email) =>
      email.status === "SCHEDULED" ||
      email.status === "PROCESSING",
  );

  const sentEmails = emails.filter(
    (email) => email.status === "SENT",
  );

  const displayedEmails =
    activeTab === "scheduled"
      ? scheduledEmails
      : sentEmails;

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#171923]">
      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[250px] border-r border-[#e8e9ef] bg-white transition-transform duration-300 lg:translate-x-0 ${
          mobileMenu
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[78px] items-center border-b border-[#f0f0f4] px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171923] text-white">
              <Send size={19} />
            </div>

            <div className="ml-3">
              <h1 className="text-[17px] font-bold">
                ReachInbox
              </h1>

              <p className="text-[11px] text-gray-400">
                Email Scheduler
              </p>
            </div>
          </div>

          <div className="flex-1 px-4 py-6">
            <nav className="space-y-1">
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Overview"
                active
              />
            </nav>

            

          <div className="relative border-t border-[#f0f0f4] p-4">
            <button
              type="button"
              onClick={() =>
                setShowProfileMenu((open) => !open)
              }
              className="flex w-full items-center rounded-xl p-2 text-left transition hover:bg-gray-50"
            >
              <Avatar user={user} />

              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {user.name}
                </p>

                <p className="truncate text-[10px] text-gray-400">
                  {user.email}
                </p>
              </div>

              <ChevronDown
                size={15}
                className={`text-gray-400 transition ${
                  showProfileMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {showProfileMenu && (
              <div className="absolute bottom-[82px] left-4 right-4 overflow-hidden rounded-xl border border-[#e7e8ee] bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>

      {mobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* MAIN */}

      <main className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[78px] items-center justify-between border-b border-[#e8e9ef] bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 hover:bg-gray-100 lg:hidden"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={20} />
            </button>

            <div>
              

              <h2 className="text-base font-bold">
  Dashboard
</h2>
            </div>
          </div>


        </header>

        <div className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 lg:px-10">
          {/* WELCOME */}

          <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-[34px]">
                {getGreeting()},{" "}
                {user.name.split(" ")[0]}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Schedule, manage, and track your emails in one place.
              </p>
            </div>

            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#171923] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-200 transition hover:-translate-y-0.5 hover:bg-black"
            >
              <Plus size={18} />
              Compose New Email
            </button>
          </section>

          {/* STATS */}

          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Send size={19} />}
              label="Total emails"
              value={String(emails.length)}
              description="All campaign emails"
            />

            <StatCard
              icon={<Clock3 size={19} />}
              label="Scheduled"
              value={String(
                scheduledEmails.length,
              )}
              description="Waiting to be sent"
            />

            <StatCard
              icon={<Send size={19} />}
              label="Sent"
              value={String(sentEmails.length)}
              description="Successfully delivered"
            />

            <StatCard
              icon={
                <span className="text-sm font-bold">
                  %
                </span>
              }
              label="Success rate"
              value={
                emails.length
                  ? `${Math.round(
                      (sentEmails.length /
                        emails.length) *
                        100,
                    )}%`
                  : "0%"
              }
              description="Across your campaigns"
            />
          </section>

          {/* EMAIL TABLE */}

          <section className="overflow-hidden rounded-2xl border border-[#e7e8ee] bg-white shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
            <div className="border-b border-[#ececf1] px-5 py-4 sm:px-6">
              <div className="flex w-fit items-center gap-1 rounded-xl bg-[#f6f6f9] p-1">
                <TabButton
                  active={
                    activeTab === "scheduled"
                  }
                  onClick={() =>
                    setActiveTab("scheduled")
                  }
                  icon={<Clock3 size={15} />}
                  label="Scheduled"
                  count={scheduledEmails.length}
                />

                <TabButton
                  active={activeTab === "sent"}
                  onClick={() =>
                    setActiveTab("sent")
                  }
                  icon={<Send size={15} />}
                  label="Sent"
                  count={sentEmails.length}
                />
              </div>
            </div>

            <div className="hidden grid-cols-[1.5fr_1.3fr_1fr_120px] gap-4 border-b border-[#f0f0f3] bg-[#fafafd] px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 md:grid">
              <span>Email</span>
              <span>Subject</span>

              <span>
                {activeTab === "scheduled"
                  ? "Scheduled time"
                  : "Sent time"}
              </span>

              <span>Status</span>
            </div>

            {loadingEmails ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-violet-600" />

                  <p className="text-xs text-gray-400">
                    Loading emails...
                  </p>
                </div>
              </div>
            ) : displayedEmails.length > 0 ? (
              displayedEmails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  activeTab={activeTab}
                />
              ))
            ) : (
              <EmptyState
                activeTab={activeTab}
                onCompose={() =>
                  setShowCompose(true)
                }
              />
            )}

            {!loadingEmails &&
              displayedEmails.length > 0 && (
                <div className="border-t border-[#f0f0f3] px-6 py-4">
                  <p className="text-xs text-gray-400">
                    Showing{" "}
                    {displayedEmails.length} emails
                  </p>
                </div>
              )}
          </section>

        </div>
      </main>

      {showCompose && (
        <ComposeModal
          user={user}
          onClose={() => setShowCompose(false)}
          onCreated={loadDashboardData}
        />
      )}
    </div>
  )
};

/* =========================================================
   LOADING
========================================================= */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-[#171923] text-white">
          <Send size={20} />
        </div>

        <p className="text-sm font-semibold">
          Loading ReachInbox...
        </p>

        <p className="mt-1 text-xs text-gray-400">
          Checking your session
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   GOOGLE ICON
========================================================= */

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
      />

      <path
        fill="#34A853"
        d="M12 21.99c2.63 0 4.84-.87 6.45-2.34l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.99Z"
      />

      <path
        fill="#FBBC05"
        d="M6.54 14.09A5.87 5.87 0 0 1 6.23 12c0-.73.13-1.44.31-2.09V7.38H3.3A9.76 9.76 0 0 0 2.25 12c0 1.57.38 3.06 1.05 4.62l3.24-2.53Z"
      />

      <path
        fill="#EA4335"
        d="M12 5.88c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 2.99 14.63 2 12 2a9.75 9.75 0 0 0-8.7 5.38l3.24 2.53C7.31 7.6 9.46 5.88 12 5.88Z"
      />
    </svg>
  );
}

/* =========================================================
   AVATAR
========================================================= */
function Avatar({ user }: { user: User }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (user.avatarUrl && !imageFailed) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        onError={() => setImageFailed(true)}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

/* =========================================================
   SIDEBAR ITEM
========================================================= */

function SidebarItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-[#f1efff] text-[#6741d9]"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}

      <span className="flex-1 text-left">
        {label}
      </span>

      {badge !== undefined && (
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
          {badge}
        </span>
      )}
    </button>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7e8ee] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.025)]">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f1ff] text-[#6741d9]">
        {icon}
      </div>

      <p className="text-xs font-medium text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-gray-400">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   TAB BUTTON
========================================================= */

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-400 hover:text-gray-700"
      }`}
    >
      {icon}

      {label}

      <span className="rounded-md bg-[#f0efff] px-1.5 py-0.5 text-[9px] text-[#6741d9]">
        {count}
      </span>
    </button>
  );
}

/* =========================================================
   EMAIL ROW
========================================================= */

function EmailRow({
  email,
  activeTab,
}: {
  email: Email;
  activeTab: "scheduled" | "sent";
}) {
  const displayTime =
    activeTab === "scheduled"
      ? email.scheduledAt
      : email.sentAt;

  return (
    <div className="grid gap-3 border-b border-[#f0f0f3] px-5 py-4 md:grid-cols-[1.5fr_1.3fr_1fr_120px] md:items-center md:gap-4 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
          {email.recipient.charAt(0).toUpperCase()}
        </div>

        <p className="truncate text-xs font-semibold">
          {email.recipient}
        </p>
      </div>

      <p className="truncate text-xs font-medium text-gray-700">
        {email.subject}
      </p>

      <p className="text-xs text-gray-600">
        {formatDate(displayTime)}
      </p>

      <StatusBadge status={email.status} />
    </div>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusBadge({
  status,
}: {
  status: EmailStatus;
}) {
  const styles: Record<EmailStatus, string> = {
    SCHEDULED:
      "bg-amber-50 text-amber-700 border-amber-100",
    PROCESSING:
      "bg-blue-50 text-blue-700 border-blue-100",
    SENT:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
    FAILED:
      "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />

      {status}
    </span>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  activeTab,
  onCompose,
}: {
  activeTab: "scheduled" | "sent";
  onCompose: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f2ff] text-[#6741d9]">
        {activeTab === "scheduled" ? (
          <Clock3 size={24} />
        ) : (
          <Send size={24} />
        )}
      </div>

      <h3 className="text-sm font-bold">
        No {activeTab} emails
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">
        {activeTab === "scheduled"
          ? "Schedule your first email campaign and it will appear here."
          : "Emails that have been successfully sent will appear here."}
      </p>

      {activeTab === "scheduled" && (
        <button
          onClick={onCompose}
          className="mt-5 flex items-center gap-2 rounded-lg bg-[#171923] px-4 py-2.5 text-xs font-semibold text-white"
        >
          <Plus size={15} />
          Compose email
        </button>
      )}
    </div>
  );
}

/* =========================================================
   INFO CARD
========================================================= */


/* =========================================================
   COMPOSE MODAL
========================================================= */

function ComposeModal({
  user,
  onClose,
  onCreated,
}: {
  user: User;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [recipients, setRecipients] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [detectedEmailCount, setDetectedEmailCount] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderEmail, setSenderEmail] = useState(user.email);
  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("2");
  const [hourlyLimit, setHourlyLimit] = useState("2");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function handleLeadFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedFile =
      file.name.toLowerCase().endsWith(".csv") ||
      file.name.toLowerCase().endsWith(".txt");

    if (!allowedFile) {
      setError("Please upload a CSV or TXT file.");
      setUploadedFileName("");
      setDetectedEmailCount(0);
      return;
    }

    setError("");
    setUploadedFileName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");

      const matches = text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      ) || [];

      const uniqueEmails = Array.from(
        new Set(matches.map((email) => email.trim().toLowerCase())),
      );

      setRecipients(uniqueEmails.join("\n"));
      setDetectedEmailCount(uniqueEmails.length);
    };

    reader.onerror = () => {
      setError("Could not read the uploaded file.");
      setUploadedFileName("");
      setDetectedEmailCount(0);
    };

    reader.readAsText(file);
  }

  async function handleCreateCampaign(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    const recipientList = recipients
      .split(/[\n,]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      setError("Please enter at least one recipient.");
      return;
    }

    const invalidRecipients = recipientList.filter(
      (email) =>
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );

    if (invalidRecipients.length > 0) {
      setError(
        `Invalid email address: ${invalidRecipients[0]}`,
      );
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!body.trim()) {
      setError("Please enter the email body.");
      return;
    }

    if (!senderEmail.trim()) {
      setError("Please enter a sender email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim())) {
      setError("Please enter a valid sender email.");
      return;
    }

    if (!startTime) {
      setError("Please select a start time.");
      return;
    }

    const delay = Number(delaySeconds);
    const limit = Number(hourlyLimit);

    if (!Number.isInteger(delay) || delay < 0) {
      setError("Delay must be a non-negative integer.");
      return;
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      setError("Hourly limit must be a positive integer.");
      return;
    }

    const firstScheduledTime = new Date(startTime);

    if (Number.isNaN(firstScheduledTime.getTime())) {
      setError("Invalid start time.");
      return;
    }

    setCreating(true);

    try {
      // Create the campaign first.
      const campaignResponse = await createCampaign({
        subject: subject.trim(),
        body: body.trim(),
        startTime: firstScheduledTime.toISOString(),
        delaySeconds: delay,
        hourlyLimit: limit,
      });

      const campaign = campaignResponse.campaign;

      // Create one BullMQ-backed scheduled email for each recipient.
      for (let index = 0; index < recipientList.length; index++) {
        const scheduledTime = new Date(
          firstScheduledTime.getTime() +
            index * delay * 1000,
        );

        await createScheduledEmail({
          campaignId: campaign.id,
          recipient: recipientList[index],
          senderEmail: senderEmail.trim(),
          scheduledAt: scheduledTime.toISOString(),
        });
      }

      // Refresh the dashboard so the new campaign/emails appear immediately.
      await onCreated();

      onClose();
    } catch (err) {
      console.error("Failed to create campaign:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create campaign.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171923] text-white">
              <Send size={16} />
            </div>

            <div>
              <h2 className="text-base font-bold">
                Compose new email
              </h2>

              <p className="text-[11px] text-gray-400">
                Create and schedule an email campaign.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleCreateCampaign}
          className="space-y-5 p-6"
        >
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700">
              Email leads
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 transition hover:border-violet-400 hover:bg-violet-50/40">
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  Upload CSV or TXT file
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  We will detect email addresses automatically.
                </p>
              </div>

              <span className="rounded-lg bg-[#171923] px-3 py-2 text-[10px] font-semibold text-white">
                Choose file
              </span>

              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleLeadFileUpload}
                className="hidden"
              />
            </label>

            {uploadedFileName && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#f8f7ff] px-4 py-3">
                <p className="truncate text-[10px] font-semibold text-gray-600">
                  {uploadedFileName}
                </p>

                <p className="ml-3 shrink-0 text-[10px] font-bold text-violet-600">
                  {detectedEmailCount}{" "}
                  {detectedEmailCount === 1
                    ? "email detected"
                    : "emails detected"}
                </p>
              </div>
            )}

            <textarea
              value={recipients}
              onChange={(event) => {
                setRecipients(event.target.value);
                setDetectedEmailCount(
                  event.target.value
                    .split(/[\n,]+/)
                    .map((email) => email.trim())
                    .filter(Boolean).length,
                );
              }}
              placeholder={`recipient1@gmail.com
recipient2@gmail.com`}
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
            />

            <p className="mt-1.5 text-[10px] text-gray-400">
              Or enter one email per line or separate emails with commas.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700">
              Sender Email
            </label>

            <input
              type="email"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              placeholder="Enter sender email"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
            />

            <p className="mt-1.5 text-[10px] text-gray-400">
              Defaults to your logged-in email. You can change it for another sender.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700">
              Subject
            </label>

            <input
              type="text"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              placeholder="Enter email subject"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700">
              Email body
            </label>

            <textarea
              value={body}
              onChange={(event) =>
                setBody(event.target.value)
              }
              placeholder="Write your email..."
              rows={6}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
            />
          </div>

          <div className="rounded-2xl bg-[#f8f7ff] p-4">
            <p className="mb-4 text-xs font-bold text-gray-700">
              Scheduling
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Start time
                </label>

                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) =>
                    setStartTime(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Delay
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={delaySeconds}
                    onChange={(event) =>
                      setDelaySeconds(event.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-14 text-xs outline-none focus:border-violet-400"
                  />

                  <span className="absolute right-3 top-2.5 text-[10px] text-gray-400">
                    sec
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Hourly limit
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={hourlyLimit}
                    onChange={(event) =>
                      setHourlyLimit(event.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-12 text-xs outline-none focus:border-violet-400"
                  />

                  <span className="absolute right-3 top-2.5 text-[10px] text-gray-400">
                    / hour
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-gray-400">
              <Clock3
                size={13}
                className="mt-0.5 shrink-0"
              />

              <p>
                Emails will be scheduled starting at the selected time.
                Each following email uses the configured delay.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#171923] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Create Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   GREETING
========================================================= */

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
  date: string | null | undefined,
) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default App;