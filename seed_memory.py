from student_memory import MemoryStore

def seed_database():
    store = MemoryStore()

    # 1. Seed Student Profile (both phone and campus email)
    profile = {
        "name": "Tommy Trojan",
        "major": "Computer Science",
        "school": "USC Viterbi School of Engineering",
        "year": "Graduate Student (MS CS, Class of 2027)",
        "courses": [
            "CS 572: Information Retrieval and Web Search Engines",
            "CS 402: Operating Systems"
        ],
        "past_events": [
            "AI@USC (Ginsburg Hall)",
            "HackSC Organization",
            "SHPE National Convention",
            "Polymathic Pizza (DML 241)"
        ],
        "clubs": [
            "SHPE USC (Society of Hispanic Professional Engineers - Graduate Representative)",
            "Viterbi Graduate Student Association (VGSA)",
            "AI@USC",
            "HackSC",
            "USC Sidney Harman Academy for Polymathic Study (Harman Fellow)",
            "Viterbi Career Connections"
        ],
        "interests": [
            "Artificial Intelligence & Autonomous Agents",
            "Systems Programming & Operating Systems (CS 402)",
            "Information Retrieval & Search Infrastructure (CS 572)",
            "Polymathic Studies & Pizza Sessions (Harman Academy)",
            "Hackathons & Makeathons",
            "Fullstack Engineering & SWE Internships",
            "Hispanic Engineers & Diversity in Tech (SHPE)",
            "Campus Free Food (Sweetgreen, Pizza, Cava, Chick-fil-A)"
        ],
        "raw_summary": (
            "Tommy is a USC Viterbi Computer Science graduate student (graduating Spring 2027). "
            "Active in SHPE USC, VGSA (Viterbi Graduate Student Association), HackSC, and AI@USC. "
            "Enrolled in CS 572 (Information Retrieval) and CS 402 (Operating Systems). "
            "Candidate for the Harman Fellows program at the Sidney Harman Academy for Polymathic Study in DML 241. "
            "Passionate about AI agents, operating systems, fullstack engineering, SWE internships, makeathons, and free food events."
        )
    }

    store.save_student_profile("+12135550100", profile)
    store.save_student_profile("student@usc.edu", profile)
    print("✅ Seeded student profile for +12135550100 and student@usc.edu")

    # 2. Seed Real Campus Events
    events = [
        (
            "AI@USC Conference & Speaker Series",
            "Today (Nov 14) 12:00 PM - 8:30 PM",
            "Ginsburg Hall (1031 Downey Way)",
            "Live keynote talks with Replit CMO Neha & TeleSign Founder Ryan Disraeli, Gemini workshop (3:30 PM), "
            "Meta Ray-Bans and AirPods giveaways, free lunch, Sweetgreen dinner (5:30-7:00 PM), and mystery night event!",
            True,
            ["AI", "tech", "free food", "giveaways", "sweetgreen", "replit", "gemini", "hacksc"]
        ),
        (
            "HackSC 2027 Flagship Hackathon",
            "Spring 2027 (Feb / March)",
            "Ronald Tutor Campus Center (TCC Ballroom)",
            "USC's premier 24-hour hackathon. 800+ hackers, sponsor challenges, mentor support, hardware lab, "
            "free meals all weekend, and top prizes for AI and social impact projects.",
            True,
            ["hackathon", "coding", "software", "AI", "projects", "free food", "teams", "swag"]
        ),
        (
            "Viterbi Career Connections: Tech Career Fair & Mixer",
            "Thursday 4:00 PM - 7:00 PM",
            "Epstein Family Engineering Plaza",
            "Networking with tech recruiters and engineering alumni hiring for Fullstack, AI/ML, and Systems roles.",
            True,
            ["career", "viterbi", "internships", "jobs", "software", "AI", "networking"]
        ),
        (
            "Sidney Harman Polymathic Pizza & Discussion",
            "Wednesday 6:00 PM - 7:30 PM",
            "Doheny Memorial Library (DML 240)",
            "Thought-provoking interdisciplinary discussion on ethics in artificial intelligence, with free artisan pizza.",
            True,
            ["polymathic", "philosophy", "pizza", "discussion", "free food", "interdisciplinary"]
        ),
        (
            "LavaLab Startup Demo Night",
            "Friday Dec 4 at 7:00 PM",
            "TCC Trojan Lounge",
            "USC's premier product incubator cohorts pitch their student startups to LA venture capitalists and founders.",
            True,
            ["startups", "pitch", "incubator", "venture", "networking", "demo day"]
        )
    ]

    for title, date_str, location, description, has_free_food, tags in events:
        store.add_event(title, date_str, location, description, has_free_food, tags)
    print(f"✅ Seeded {len(events)} campus events")

    # 3. Seed Campus Clubs (RSOs)
    clubs = [
        (
            "AI@USC",
            "Tech / Artificial Intelligence",
            "USC's leading student organization focused on democratizing AI through speaker series, technical workshops, "
            "and project incubators.",
            "Thursdays 7:00 PM at Ginsburg Hall"
        ),
        (
            "HackSC",
            "Tech / Hackathon Organization",
            "The team that organizes USC's flagship annual hackathon, fostering hacker culture and tech innovation across Southern California.",
            "Weekly team meetings & hack nights at RTCC"
        ),
        (
            "CAIS++ (Center for AI in Society Student Branch)",
            "AI / Social Impact",
            "Applies machine learning, NLP, and computer vision to solve critical societal challenges in healthcare, conservation, and homelessness.",
            "Tuesdays 6:30 PM at SAL 126"
        ),
        (
            "LavaLab",
            "Entrepreneurship / Product",
            "USC's premier student product incubator. Each semester, students form teams of developers, designers, and PMs to take products from ideation to launch.",
            "Cohort based at Leavey & Village"
        ),
        (
            "ACM at USC",
            "Computer Science",
            "Association for Computing Machinery. Hosts coding interview prep, technical workshops, LeetCode nights, and faculty chats.",
            "Wednesdays 7:00 PM at OHE 122"
        ),
        (
            "Makers at USC",
            "Robotics & Hardware",
            "Hardware hacking and prototyping collective with access to 3D printers, laser cutters, and electronics benches.",
            "Baum Family Maker Space"
        ),
        (
            "TroyLabs",
            "Venture & Startups",
            "Student-run accelerator empowering Trojan founders with capital, mentorship, and connections to top Silicon Beach and SV venture firms.",
            "Bi-weekly workshops at Fertitta Hall"
        )
    ]

    for name, category, description, meeting_times in clubs:
        store.add_club(name, category, description, meeting_times)
    print(f"✅ Seeded {len(clubs)} campus clubs")


if __name__ == "__main__":
    seed_database()
