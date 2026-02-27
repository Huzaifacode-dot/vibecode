from app import app
from database import db
from models import User, Skill, Interest, Event
from werkzeug.security import generate_password_hash
import random
import traceback

def seed_database():
    with app.app_context():
        # Ensure new schema tables exist
        db.create_all()
        
        # Clear existing data
        db.drop_all()
        db.create_all()

        print("Seeding database...")

        # Skills and Interests pool
        skills_pool = ["python", "java", "react", "html", "css", "machine learning", "data science", "sql", "node.js", "docker", "aws"]
        interests_pool = ["hackathons", "ai research", "web dev", "app dev", "cloud computing", "open source", "cybersecurity"]
        branches = ["Computer Science", "Information Technology", "Electronics", "Mechanical"]
        years = ["1st Year", "2nd Year", "3rd Year", "4th Year"]

        users = []

        # Create normal users
        for i in range(1, 16):
            user = User(
                name=f"Student {i}",
                email=f"student{i}@college.edu",
                password_hash=generate_password_hash("password123"),
                branch=random.choice(branches),
                year=random.choice(years),
                bio=f"Hi, I'm Student {i}. Enthusiastic about tech."
            )
            db.session.add(user)
        
        db.session.commit()
        
        # Reload users to get IDs attached
        users = User.query.filter(User.name.like("Student%")).all()

        # Add skills and interests
        for u in users:
            num_skills = random.randint(2, 5)
            num_interests = random.randint(1, 4)
            
            u_skills = random.sample(skills_pool, num_skills)
            u_interests = random.sample(interests_pool, num_interests)

            for s in u_skills:
                db.session.add(Skill(user_id=u.id, skill_name=s))
            for int_name in u_interests:
                db.session.add(Interest(user_id=u.id, interest_name=int_name))

        # Create a few fake profiles (High activity or 0 skills)
        fake1 = User(name="Bot User X", email="botx@spam.com", password_hash=generate_password_hash("123"), branch="Unknown", year="Unknown", bio="Click my link!")
        fake2 = User(name="Spam Bot Y", email="boty@spam.com", password_hash=generate_password_hash("123"), branch="Unknown", year="Unknown", bio="Buy crypto!")
        db.session.add(fake1)
        db.session.add(fake2)
        db.session.commit()
        
        # Add to the active array for other seeds
        users.append(fake1)
        users.append(fake2)
        
        # Add excessive random events for the fakes to trigger anomaly detection
        for i in range(10):
            db.session.add(Event(creator_id=fake1.id, title=f"Spam Event {i}", description="Spam", date="2024-01-01"))
        
        # Normal events
        db.session.add(Event(creator_id=users[0].id, title="Hackathon Prep", description="Let's build a team for the upcoming hackathon!", date="2026-03-10", tags="hackathon,coding"))
        db.session.add(Event(creator_id=users[1].id, title="AI Study Group", description="Discussing Neural Networks.", date="2026-03-15", tags="ai,machine learning"))

        from models import ProjectRequirement, Message, Subject, AttendanceRecord, Post, PostLike, PostComment
        
        # Add sample projects for Skill Gap Analyzer
        projects = [
            ProjectRequirement(
                project_name="Machine Learning Image Classifier",
                description="Build a CNN to classify common objects.",
                required_skills="python, machine learning, sql"
            ),
            ProjectRequirement(
                project_name="Full-Stack Web Store",
                description="Develop a fully scalable web application.",
                required_skills="react, node.js, aws, sql"
            ),
            ProjectRequirement(
                project_name="Data Analytics Dashboard",
                description="Analyze large datasets and present visualized insights.",
                required_skills="python, data science, sql"
            )
        ]
        db.session.add_all(projects)

        # Build some dummy chat history
        # Bob (user 1) is active and friendly
        for _ in range(3):
             db.session.add(Message(sender_id=users[1].id, receiver_id=users[0].id, content="Hey Alice, wanna collaborate on the ML project?"))
             db.session.add(Message(sender_id=users[0].id, receiver_id=users[1].id, content="Yes! Let's meet at the library."))
        
        # SuperBot (users[3]) sends massive spam
        for u in users[:3]:
             for _ in range(6):
                  db.session.add(Message(sender_id=users[3].id, receiver_id=u.id, content="Hello! Get free crypto! Click my profile link!"))

        # GhostUser (users[4]) sends a few messages but has zero skills or events
        for _ in range(4):
             db.session.add(Message(sender_id=users[4].id, receiver_id=users[0].id, content="hi."))

        # Sub-Seed 2: Attendance Tracker
        subjects = [
             Subject(subject_name="Data Structures", total_classes=40),
             Subject(subject_name="DBMS", total_classes=40),
             Subject(subject_name="Operating Systems", total_classes=40),
             Subject(subject_name="Computer Networks", total_classes=35),
             Subject(subject_name="Machine Learning", total_classes=30)
        ]
        db.session.add_all(subjects)
        db.session.commit() # Save to DB first so IDs are generated

        # Seed attendance for all 5 users
        for u in users:
             for s in subjects:
                  # Generate some random, but somewhat realistic data
                  # Give the Demo Student mostly good attendance to start (80-100%)
                  if u.email == 'student1@college.edu':
                       attended = random.randint(int(s.total_classes * 0.75), s.total_classes)
                       recent_abs = random.randint(0, 1)
                       days_since = random.randint(0, 2)
                  # Give SuperBot and GhostUser terrible attendance (0-40%) so ML has risky data
                  elif u.name in ['SuperBot', 'GhostUser']:
                       attended = random.randint(0, int(s.total_classes * 0.40))
                       recent_abs = random.randint(3, 5)
                       days_since = random.randint(10, 30)
                  # Random for others (50-95%)
                  else:
                       attended = random.randint(int(s.total_classes * 0.50), int(s.total_classes * 0.95))
                       recent_abs = random.randint(0, 4)
                       days_since = random.randint(0, 10)
                       
                  record = AttendanceRecord(
                       user_id=u.id,
                       subject_id=s.id,
                       classes_attended=attended,
                       recent_absences_last_5=recent_abs,
                       days_since_last_present=days_since
                  )
                  db.session.add(record)

        # Seed Social Feed Posts
        posts = [
             Post(user_id=users[0].id, content="Just built my first React app! Looking for feedback! 🚀", likes_count=5),
             Post(user_id=users[1].id, content="Anyone going to the ML workshop tomorrow?", likes_count=12),
             Post(user_id=users[2].id, content="Stuck on a Python dictionary bug... any ideas?', image_url=None", likes_count=2),
             Post(user_id=users[0].id, content="Hackathon team forming: Need one top-tier SQL developer! Send me a message if interested.", likes_count=20)
        ]
        db.session.add_all(posts)
        db.session.commit()

        # Seed some dummy comments
        comments = [
            PostComment(post_id=posts[0].id, user_id=users[1].id, content="Looks awesome! Do you have a github link?"),
            PostComment(post_id=posts[1].id, user_id=users[0].id, content="I'll be there!"),
            PostComment(post_id=posts[3].id, user_id=users[2].id, content="Messaged you.")
        ]
        db.session.add_all(comments)
        
        db.session.commit()
        print("Database seeded successfully!")

if __name__ == '__main__':
    seed_database()
