export type CampusResource = {
  id: string;
  name: string;
  category: string;
  description: string;
  helpfulFor: string;
  actionLabel: string;
  url: string;
};

export const RESOURCE_CATEGORIES = [
  "Career & Professional",
  "Academic & Learning",
  "Health & Wellbeing",
  "Accessibility & Accommodations",
  "Student Support",
  "Community & Belonging",
] as const;

export const CAMPUS_RESOURCES: CampusResource[] = [
  {
    id: "career-center",
    name: "USC Career Center",
    category: "Career & Professional",
    description: "Explore career paths, appointments, internships, jobs, and career-development resources.",
    helpfulFor: "Students exploring careers or looking for an internship or job.",
    actionLabel: "Explore career services",
    url: "https://careers.usc.edu/channels/student",
  },
  {
    id: "kortschak-center",
    name: "Kortschak Center for Learning and Creativity",
    category: "Academic & Learning",
    description: "Find academic coaching, workshops, study strategies, and learning resources.",
    helpfulFor: "Enrolled students looking for support with learning strategies or study skills.",
    actionLabel: "Explore academic support",
    url: "https://kortschakcenter.usc.edu/",
  },
  {
    id: "writing-center",
    name: "USC Writing Center",
    category: "Academic & Learning",
    description: "Get free, individualized feedback on essays, cover letters, applications, and other writing.",
    helpfulFor: "Current USC students who want feedback at any stage of a writing project.",
    actionLabel: "Schedule a writing appointment",
    url: "https://dornsife.usc.edu/writingcenter/appointments/",
  },
  {
    id: "usc-libraries",
    name: "USC Libraries",
    category: "Academic & Learning",
    description: "Search library collections and find research help, databases, and library services.",
    helpfulFor: "Students working on research or looking for library resources.",
    actionLabel: "Visit USC Libraries",
    url: "https://libraries.usc.edu/",
  },
  {
    id: "student-health",
    name: "USC Student Health",
    category: "Health & Wellbeing",
    description: "Connect with medical care, counseling and mental health services, and appointment information.",
    helpfulFor: "Students looking for health services or information about care options.",
    actionLabel: "Explore health services",
    url: "https://studenthealth.usc.edu/",
  },
  {
    id: "osas",
    name: "Office of Student Accessibility Services",
    category: "Accessibility & Accommodations",
    description: "Learn how to connect with OSAS and explore accommodations and accessibility services.",
    helpfulFor: "Students exploring disability-related access services or accommodations.",
    actionLabel: "Get started with OSAS",
    url: "https://osas.usc.edu/new-students/",
  },
  {
    id: "basic-needs",
    name: "Student Basic Needs",
    category: "Student Support",
    description: "Find food, housing, and economic-support resources offered through USC.",
    helpfulFor: "Students looking for food, housing, or financial resources to explore.",
    actionLabel: "Explore basic-needs support",
    url: "https://studentbasicneeds.usc.edu/",
  },
  {
    id: "campus-support",
    name: "Campus Support & Intervention",
    category: "Student Support",
    description: "Find guidance and consultations for academic, health, basic-needs, and other student concerns.",
    helpfulFor: "Students who are unsure where to start or who to contact.",
    actionLabel: "Find student support",
    url: "https://campussupport.usc.edu/students/",
  },
  {
    id: "student-culture-community",
    name: "Student Culture & Community Centers",
    category: "Community & Belonging",
    description: "Explore campus centers and spaces for cultural programming, connection, and support.",
    helpfulFor: "Students looking for community spaces and ways to connect on campus.",
    actionLabel: "Explore campus centers",
    url: "https://youbelong.usc.edu/centers-offices-and-spaces",
  },
];
