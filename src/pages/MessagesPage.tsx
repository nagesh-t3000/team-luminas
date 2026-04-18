import { useEffect, useMemo, useState, type FormEvent } from "react";
import { currentUser, users, type User } from "@/data/mockData";
import { getAuthUserAvatarUrl, getStoredAuthUser } from "@/lib/appAuth";

type ThreadMessage = {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
};

type MessageThread = {
  id: string;
  participantId: string;
  presence: string;
  unreadCount: number;
  updatedAt: string;
  messages: ThreadMessage[];
};

const MESSAGE_STORAGE_PREFIX = "luminas-messages";

function createTimestamp(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

const seededThreads: MessageThread[] = [
  {
    id: "thread-u1",
    participantId: "u1",
    presence: "Reviewed your traction update 8m ago",
    unreadCount: 2,
    updatedAt: createTimestamp(8),
    messages: [
      {
        id: "m-1",
        senderId: "u1",
        text: "Appreciate the intro deck. The churn trend looked much better this month.",
        sentAt: createTimestamp(25),
      },
      {
        id: "m-2",
        senderId: currentUser.id,
        text: "Thanks. We tightened onboarding and pushed the self-serve upgrade flow live last week.",
        sentAt: createTimestamp(19),
      },
      {
        id: "m-3",
        senderId: "u1",
        text: "Nice. Send over the April cohort retention screenshot when you can.",
        sentAt: createTimestamp(8),
      },
    ],
  },
  {
    id: "thread-u2",
    participantId: "u2",
    presence: "Active now",
    unreadCount: 0,
    updatedAt: createTimestamp(34),
    messages: [
      {
        id: "m-4",
        senderId: currentUser.id,
        text: "Your migration write-up was sharp. Are you open to comparing notes on data contracts?",
        sentAt: createTimestamp(52),
      },
      {
        id: "m-5",
        senderId: "u2",
        text: "Absolutely. I can share the guardrails we used for rollback and shadow traffic.",
        sentAt: createTimestamp(34),
      },
    ],
  },
  {
    id: "thread-u3",
    participantId: "u3",
    presence: "Usually replies in under an hour",
    unreadCount: 0,
    updatedAt: createTimestamp(98),
    messages: [
      {
        id: "m-6",
        senderId: "u3",
        text: "We just opened three backend roles. Want me to forward the staff infra spec?",
        sentAt: createTimestamp(120),
      },
      {
        id: "m-7",
        senderId: currentUser.id,
        text: "Please do. I also know two engineers who may be relevant for the platform opening.",
        sentAt: createTimestamp(98),
      },
    ],
  },
  {
    id: "thread-u4",
    participantId: "u4",
    presence: "In Austin this week",
    unreadCount: 1,
    updatedAt: createTimestamp(185),
    messages: [
      {
        id: "m-8",
        senderId: "u4",
        text: "We are hosting a small founder dinner after demo day. Want an invite?",
        sentAt: createTimestamp(185),
      },
    ],
  },
  {
    id: "thread-u5",
    participantId: "u5",
    presence: "Last online yesterday",
    unreadCount: 0,
    updatedAt: createTimestamp(1580),
    messages: [
      {
        id: "m-9",
        senderId: currentUser.id,
        text: "Would love your take on pricing before we reopen the round.",
        sentAt: createTimestamp(1670),
      },
      {
        id: "m-10",
        senderId: "u5",
        text: "Happy to help. Send me the latest packaging and I will leave notes inline.",
        sentAt: createTimestamp(1580),
      },
    ],
  },
  {
    id: "thread-u8",
    participantId: "u8",
    presence: "Available for advisory intros",
    unreadCount: 0,
    updatedAt: createTimestamp(4320),
    messages: [
      {
        id: "m-11",
        senderId: "u8",
        text: "Strong activation work. If you need a pricing gut check, I can spare 20 minutes tomorrow.",
        sentAt: createTimestamp(4320),
      },
    ],
  },
];

function getStorageKey(selfId: string) {
  return `${MESSAGE_STORAGE_PREFIX}:${selfId}`;
}

function sortThreads(threads: MessageThread[]) {
  return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function loadThreads(selfId: string) {
  const storedValue = localStorage.getItem(getStorageKey(selfId));

  if (!storedValue) {
    return sortThreads(seededThreads);
  }

  try {
    const parsed = JSON.parse(storedValue) as MessageThread[];
    return sortThreads(Array.isArray(parsed) ? parsed : seededThreads);
  } catch {
    localStorage.removeItem(getStorageKey(selfId));
    return sortThreads(seededThreads);
  }
}

function formatListTimestamp(value: string) {
  const sentAt = new Date(value).getTime();
  const diffMs = Date.now() - sentAt;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `${Math.max(1, Math.round(diffMs / (60 * 1000)))}m`;
  }

  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h`;
  }

  if (diffMs < 7 * day) {
    return `${Math.round(diffMs / day)}d`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatThreadTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function makeNewThread(participantId: string): MessageThread {
  const now = new Date().toISOString();
  return {
    id: `thread-${participantId}`,
    participantId,
    presence: "New conversation",
    unreadCount: 0,
    updatedAt: now,
    messages: [
      {
        id: `msg-${participantId}-intro`,
        senderId: participantId,
        text: "Opened a thread on Luminas. Drop a note when you are ready.",
        sentAt: now,
      },
    ],
  };
}

type InboxThread = MessageThread & {
  participant: User;
  lastMessage: ThreadMessage;
};

export function MessagesPage() {
  const authUser = getStoredAuthUser();
  const selfId = authUser?.id || currentUser.id;
  const selfUsername = authUser?.username || currentUser.username;
  const selfAvatarUrl = getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl;
  const selfFullName = authUser?.full_name?.trim() || currentUser.fullName;

  const [threads, setThreads] = useState<MessageThread[]>(() => loadThreads(selfId));
  const [searchValue, setSearchValue] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);

  const participantMap = useMemo(
    () => new Map(users.filter((user) => user.id !== currentUser.id).map((user) => [user.id, user])),
    [],
  );

  useEffect(() => {
    setThreads(loadThreads(selfId));
  }, [selfId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(selfId), JSON.stringify(threads));
  }, [selfId, threads]);

  const inboxThreads = useMemo<InboxThread[]>(
    () =>
      sortThreads(threads)
        .map((thread) => {
          const participant = participantMap.get(thread.participantId);
          const lastMessage = thread.messages[thread.messages.length - 1];

          if (!participant || !lastMessage) {
            return null;
          }

          return {
            ...thread,
            participant,
            lastMessage,
          };
        })
        .filter((thread): thread is InboxThread => thread !== null),
    [participantMap, threads],
  );

  const filteredThreads = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    if (!normalizedQuery) {
      return inboxThreads;
    }

    return inboxThreads.filter((thread) => {
      const haystack = [
        thread.participant.username,
        thread.participant.fullName,
        thread.participant.headline,
        thread.lastMessage.text,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [inboxThreads, searchValue]);

  const selectedThread = useMemo(
    () => inboxThreads.find((thread) => thread.id === selectedThreadId) ?? null,
    [inboxThreads, selectedThreadId],
  );

  const suggestedPeople = useMemo(
    () =>
      users.filter(
        (user) => user.id !== currentUser.id && !threads.some((thread) => thread.participantId === user.id),
      ),
    [threads],
  );

  useEffect(() => {
    if (!selectedThreadId && inboxThreads.length > 0) {
      setSelectedThreadId(inboxThreads[0].id);
    }
  }, [inboxThreads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === selectedThreadId && thread.unreadCount > 0 ? { ...thread, unreadCount: 0 } : thread,
      ),
    );
  }, [selectedThreadId]);

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setIsMobileThreadOpen(true);
  }

  function handleStartThread(participantId: string) {
    const existingThread = inboxThreads.find((thread) => thread.participantId === participantId);

    if (existingThread) {
      handleSelectThread(existingThread.id);
      return;
    }

    const nextThread = makeNewThread(participantId);
    setThreads((currentThreads) => sortThreads([nextThread, ...currentThreads]));
    setSelectedThreadId(nextThread.id);
    setIsMobileThreadOpen(true);
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage || !selectedThread) {
      return;
    }

    const sentAt = new Date().toISOString();
    const nextMessage: ThreadMessage = {
      id: `msg-${selectedThread.id}-${Date.now()}`,
      senderId: selfId,
      text: trimmedMessage,
      sentAt,
    };

    setThreads((currentThreads) =>
      sortThreads(
        currentThreads.map((thread) =>
          thread.id === selectedThread.id
            ? {
                ...thread,
                updatedAt: sentAt,
                unreadCount: 0,
                messages: [...thread.messages, nextMessage],
              }
            : thread,
        ),
      ),
    );
    setDraftMessage("");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-110px)] w-full max-w-[1100px] flex-col overflow-hidden bg-ig-surface md:mt-6 md:min-h-[80vh] md:flex-row md:rounded-3xl md:border md:border-ig-border md:shadow-sm">
      <section
        className={[
          "w-full shrink-0 border-ig-border md:flex md:w-[370px] md:flex-col md:border-r",
          isMobileThreadOpen ? "hidden md:flex" : "flex flex-col",
        ].join(" ")}
      >
        <header className="border-b border-ig-border px-4 py-4 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[17px] font-semibold">{selfUsername}</p>
              <p className="text-[13px] text-ig-muted">{inboxThreads.length} active conversations</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ig-border">
              <img src={selfAvatarUrl} alt="" className="h-full w-full object-cover" width={40} height={40} />
            </span>
          </div>
          <label className="mt-4 block">
            <span className="sr-only">Search messages</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search messages"
              className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm outline-none transition focus:border-black/20"
            />
          </label>
        </header>

        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length > 0 ? (
            <ul className="divide-y divide-ig-border">
              {filteredThreads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                const isLastMessageFromSelf = thread.lastMessage.senderId === selfId;

                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectThread(thread.id)}
                      className={[
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] md:px-5",
                        isSelected ? "bg-black/[0.03]" : "",
                      ].join(" ")}
                    >
                      <span className="relative shrink-0">
                        <img
                          src={thread.participant.avatarUrl}
                          alt=""
                          className="h-14 w-14 rounded-full object-cover"
                          width={56}
                          height={56}
                        />
                        {thread.unreadCount > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[11px] font-semibold text-white">
                            {thread.unreadCount}
                          </span>
                        ) : null}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-[14px] font-semibold">{thread.participant.username}</span>
                          <span className="shrink-0 text-[12px] text-ig-muted">{formatListTimestamp(thread.updatedAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-ig-muted">{thread.presence}</span>
                        <span className="mt-1 block truncate text-[14px] text-ig-muted">
                          {isLastMessageFromSelf ? "You: " : ""}
                          {thread.lastMessage.text}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-ig-text">No conversations match your search.</p>
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="mt-3 rounded-full border border-ig-border px-4 py-2 text-sm font-medium text-ig-text"
              >
                Clear search
              </button>
            </div>
          )}

          {suggestedPeople.length > 0 ? (
            <div className="border-t border-ig-border px-4 py-4 md:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ig-text">Start a new thread</p>
                  <p className="text-[13px] text-ig-muted">Reach out to people in your network.</p>
                </div>
              </div>
              <div className="grid gap-2">
                {suggestedPeople.slice(0, 3).map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleStartThread(person.id)}
                    className="flex items-center gap-3 rounded-2xl border border-ig-border px-3 py-3 text-left transition hover:bg-black/[0.02]"
                  >
                    <img src={person.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" width={40} height={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ig-text">{person.fullName}</span>
                      <span className="block truncate text-[13px] text-ig-muted">{person.headline}</span>
                    </span>
                    <span className="rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white">Message</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className={[
          "min-h-[calc(100vh-110px)] flex-1 flex-col md:min-h-0",
          isMobileThreadOpen ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        {selectedThread ? (
          <>
            <header className="flex items-center gap-3 border-b border-ig-border px-4 py-3 md:px-6">
              <button
                type="button"
                onClick={() => setIsMobileThreadOpen(false)}
                className="rounded-full p-2 text-ig-text md:hidden"
                aria-label="Back to inbox"
              >
                <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <img
                src={selectedThread.participant.avatarUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
                width={44}
                height={44}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{selectedThread.participant.fullName}</p>
                <p className="truncate text-[13px] text-ig-muted">
                  @{selectedThread.participant.username} · {selectedThread.presence}
                </p>
              </div>
              <button
                type="button"
                className="hidden rounded-full border border-ig-border px-4 py-2 text-sm font-medium text-ig-text md:inline-flex"
                onClick={() => setDraftMessage(`Hi ${selectedThread.participant.fullName.split(" ")[0]}, `)}
              >
                Quick intro
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(250,250,250,0.8)_0%,rgba(255,255,255,1)_18%)] px-4 py-5 md:px-6">
              <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
                <div className="mb-3 flex flex-col items-center text-center">
                  <img
                    src={selectedThread.participant.avatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover"
                    width={80}
                    height={80}
                  />
                  <p className="mt-3 text-base font-semibold text-ig-text">{selectedThread.participant.fullName}</p>
                  <p className="mt-1 max-w-md text-sm text-ig-muted">{selectedThread.participant.headline}</p>
                </div>

                {selectedThread.messages.map((message) => {
                  const isOwnMessage = message.senderId === selfId;

                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                        {!isOwnMessage ? (
                          <span className="mb-1 text-[12px] text-ig-muted">{selectedThread.participant.username}</span>
                        ) : null}
                        <div
                          className={[
                            "rounded-3xl px-4 py-3 text-[14px] leading-6 shadow-sm",
                            isOwnMessage ? "bg-black text-white" : "border border-ig-border bg-white text-ig-text",
                          ].join(" ")}
                        >
                          {message.text}
                        </div>
                        <span className="mt-1 px-1 text-[12px] text-ig-muted">{formatThreadTimestamp(message.sentAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-ig-border px-4 py-3 md:px-6">
              <div className="mx-auto flex w-full max-w-[680px] items-end gap-3 rounded-[28px] border border-ig-border bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="message-draft">
                    Message {selectedThread.participant.fullName}
                  </label>
                  <textarea
                    id="message-draft"
                    rows={1}
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder={`Message ${selectedThread.participant.fullName}`}
                    className="max-h-32 min-h-[28px] w-full resize-none border-0 bg-transparent text-[14px] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!draftMessage.trim()}
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-black/20"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-ig-border">
                <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16v10H8l-4 4z" />
                </svg>
              </div>
              <p className="mt-4 text-lg font-semibold text-ig-text">Your messages</p>
              <p className="mt-2 text-sm text-ig-muted">
                Select a conversation to keep up with investors, candidates, and collaborators.
              </p>
              <p className="mt-4 text-[13px] text-ig-muted">{selfFullName}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
