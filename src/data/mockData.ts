export type UserRole = "founder" | "investor" | "job_seeker" | "recruiter" | "advisor";

export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  role: UserRole;
  headline: string;
  verified?: boolean;
}

export interface Story {
  userId: string;
  previewUrl: string;
  label: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
}

export interface Post {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: Comment[];
  location?: string;
  timestamp: string;
}

export const currentUser: User = {
  id: "u-self",
  username: "alexrivera",
  fullName: "Alex Rivera",
  avatarUrl: "https://i.pravatar.cc/150?img=12",
  role: "founder",
  headline: "B2B SaaS · raising seed",
  verified: true,
};

export const users: User[] = [
  currentUser,
  {
    id: "u1",
    username: "nvcapital",
    fullName: "Northvale Capital",
    avatarUrl: "https://i.pravatar.cc/150?img=33",
    role: "investor",
    headline: "Series A–C · fintech & infra",
    verified: true,
  },
  {
    id: "u2",
    username: "priya.codes",
    fullName: "Priya Nair",
    avatarUrl: "https://i.pravatar.cc/150?img=45",
    role: "job_seeker",
    headline: "Staff engineer · open to remote",
  },
  {
    id: "u3",
    username: "talentgrid_io",
    fullName: "TalentGrid",
    avatarUrl: "https://i.pravatar.cc/150?img=68",
    role: "recruiter",
    headline: "Hiring: ML, product, GTM",
    verified: true,
  },
  {
    id: "u4",
    username: "marcuszhou",
    fullName: "Marcus Zhou",
    avatarUrl: "https://i.pravatar.cc/150?img=11",
    role: "founder",
    headline: "Climate hardware · YC W26",
  },
  {
    id: "u5",
    username: "elenavc",
    fullName: "Elena Vasquez",
    avatarUrl: "https://i.pravatar.cc/150?img=5",
    role: "investor",
    headline: "Angel · consumer & AI apps",
  },
  {
    id: "u6",
    username: "hireloop",
    fullName: "HireLoop",
    avatarUrl: "https://i.pravatar.cc/150?img=59",
    role: "recruiter",
    headline: "Senior roles · EU & US",
  },
  {
    id: "u7",
    username: "jordan.lee",
    fullName: "Jordan Lee",
    avatarUrl: "https://i.pravatar.cc/150?img=32",
    role: "job_seeker",
    headline: "Product designer · NYC",
  },
  {
    id: "u8",
    username: "sage_advisory",
    fullName: "Sage Advisory",
    avatarUrl: "https://i.pravatar.cc/150?img=52",
    role: "advisor",
    headline: "GTM & pricing for startups",
    verified: true,
  },
];

const byId = (id: string) => users.find((u) => u.id === id)!;

export const stories: Story[] = [
  { userId: "u1", previewUrl: "https://picsum.photos/seed/s1/200/200", label: "Deal flow" },
  { userId: "u2", previewUrl: "https://picsum.photos/seed/s2/200/200", label: "Portfolio" },
  { userId: "u3", previewUrl: "https://picsum.photos/seed/s3/200/200", label: "Open roles" },
  { userId: "u4", previewUrl: "https://picsum.photos/seed/s4/200/200", label: "Demo day" },
  { userId: "u5", previewUrl: "https://picsum.photos/seed/s5/200/200", label: "Thesis" },
  { userId: "u6", previewUrl: "https://picsum.photos/seed/s6/200/200", label: "Tips" },
  { userId: "u7", previewUrl: "https://picsum.photos/seed/s7/200/200", label: "Case study" },
  { userId: "u8", previewUrl: "https://picsum.photos/seed/s8/200/200", label: "AMA" },
];

export const posts: Post[] = [
  {
    id: "p1",
    userId: "u1",
    imageUrl: "https://picsum.photos/seed/p1/1080/1080",
    caption:
      "Closed a follow-on for our portfolio company in payments infra. Operators who ship in regulated markets are rare—if that is you, send deck + metrics.",
    likes: 1842,
    comments: [
      { id: "c1", userId: "u4", text: "Congrats team—well deserved." },
      { id: "c2", userId: "u2", text: "Love seeing infra get real multiples again." },
    ],
    location: "San Francisco, CA",
    timestamp: "2h",
  },
  {
    id: "p2",
    userId: "u3",
    imageUrl: "https://picsum.photos/seed/p2/1080/1080",
    caption:
      "We are hiring a Staff Backend Engineer (Go, Postgres, Kafka). Remote within US time zones. DM keyword STAFF for JD.",
    likes: 612,
    comments: [{ id: "c3", userId: "u2", text: "Applied via site—thanks for posting comp bands." }],
    timestamp: "5h",
  },
  {
    id: "p3",
    userId: "u4",
    imageUrl: "https://picsum.photos/seed/p3/1080/1080",
    caption:
      "Week 6: first pilot units in the field. Hardware is hard; distribution is harder. Shoutout to our early customers who debug with us on Sundays.",
    likes: 3201,
    comments: [
      { id: "c4", userId: "u5", text: "Proud investor moment." },
      { id: "c5", userId: "u8", text: "Pricing page is crisp—nice work." },
    ],
    location: "Austin, TX",
    timestamp: "1d",
  },
  {
    id: "p4",
    userId: "u8",
    imageUrl: "https://picsum.photos/seed/p4/1080/1080",
    caption:
      "Hot take: your PLG funnel is fine; your activation definition is wrong. 3 signals we look at in week one audits (thread).",
    likes: 987,
    comments: [],
    timestamp: "2d",
  },
  {
    id: "p5",
    userId: "u2",
    imageUrl: "https://picsum.photos/seed/p5/1080/1080",
    caption:
      "Shipped a zero-downtime migration affecting 400M rows. Write-up on trade-offs between expand/contract vs shadow writes—link in bio.",
    likes: 2410,
    comments: [{ id: "c6", userId: "u6", text: "Would love to chat about a staff role on our platform team." }],
    timestamp: "3d",
  },
];

export function userById(id: string): User {
  return byId(id);
}

export const suggestedUsers = users.filter((u) => u.id !== currentUser.id).slice(0, 5);

export const roleLabel: Record<UserRole, string> = {
  founder: "Founder",
  investor: "Investor",
  job_seeker: "Job seeker",
  recruiter: "Recruiter",
  advisor: "Advisor",
};
