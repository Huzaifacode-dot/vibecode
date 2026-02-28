from database import db
from datetime import datetime

class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_name = db.Column(db.String(100), nullable=False)
    total_classes = db.Column(db.Integer, nullable=False, default=40)
    
    def to_dict(self):
        return {
            "id": self.id,
            "subject_name": self.subject_name,
            "total_classes": self.total_classes
        }

class AttendanceRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    classes_attended = db.Column(db.Integer, nullable=False, default=0)
    recent_absences_last_5 = db.Column(db.Integer, nullable=False, default=0)
    days_since_last_present = db.Column(db.Integer, nullable=False, default=0)
    
    subject = db.relationship('Subject', backref='attendance_records', lazy=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "subject_id": self.subject_id,
            "subject_name": self.subject.subject_name if self.subject else "",
            "total_classes": self.subject.total_classes if self.subject else 0,
            "classes_attended": self.classes_attended,
            "recent_absences_last_5": self.recent_absences_last_5,
            "days_since_last_present": self.days_since_last_present
        }

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    branch = db.Column(db.String(50))
    year = db.Column(db.String(20))
    bio = db.Column(db.Text)
    is_admin = db.Column(db.Boolean, default=False)
    is_suspicious = db.Column(db.Boolean, default=False)
    is_suspended = db.Column(db.Boolean, default=False)
    trust_score = db.Column(db.Integer, default=50)
    profile_photo = db.Column(db.String(255), nullable=True)
    
    # Relationships
    skills = db.relationship('Skill', backref='user', lazy=True, cascade="all, delete-orphan")
    interests = db.relationship('Interest', backref='user', lazy=True, cascade="all, delete-orphan")
    events_created = db.relationship('Event', backref='creator', lazy=True, cascade="all, delete-orphan")
    attendance_records = db.relationship('AttendanceRecord', backref='user', lazy=True, cascade="all, delete-orphan")
    posts = db.relationship('Post', backref='author', lazy=True, cascade="all, delete-orphan")
    post_likes = db.relationship('PostLike', backref='user', lazy=True, cascade="all, delete-orphan")
    post_comments = db.relationship('PostComment', backref='author', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "branch": self.branch,
            "year": self.year,
            "bio": self.bio,
            "is_admin": self.is_admin,
            "is_suspicious": self.is_suspicious,
            "trust_score": self.trust_score,
            "profile_photo": self.profile_photo,
            "skills": [s.skill_name for s in self.skills],
            "interests": [i.interest_name for i in self.interests],
            "is_suspended": self.is_suspended
        }

class AdminAuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    target_id = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    admin = db.relationship('User', foreign_keys=[admin_id], backref='admin_logs', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "admin_id": self.admin_id,
            "admin_name": self.admin.name if self.admin else "Unknown",
            "action": self.action,
            "target_id": self.target_id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }

class Skill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    skill_name = db.Column(db.String(100), nullable=False)

class Interest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    interest_name = db.Column(db.String(100), nullable=False)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(100), nullable=False)
    tags = db.Column(db.String(200), nullable=True) # Comma-separated
    
    participants = db.relationship('EventParticipant', backref='event', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "creator_id": self.creator_id,
            "creator_name": self.creator.name if self.creator else None,
            "title": self.title,
            "description": self.description,
            "date": self.date,
            "tags": self.tags,
            "participants": len(self.participants)
        }

class EventParticipant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "content": self.content,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_read": self.is_read
        }

class Connection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(50), default='pending') # pending, accepted

class ProjectRequirement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    required_skills = db.Column(db.String(500), nullable=False) # Comma-separated list of skills

    def to_dict(self):
        return {
            "id": self.id,
            "project_name": self.project_name,
            "description": self.description,
            "required_skills": [s.strip() for s in self.required_skills.split(',') if s.strip()]
        }

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    likes_count = db.Column(db.Integer, default=0)

    comments = db.relationship('PostComment', backref='post', lazy=True, cascade="all, delete-orphan")
    likes = db.relationship('PostLike', backref='post', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "author_name": self.author.name if getattr(self, 'author', None) else "Unknown",
            "author_photo": self.author.profile_photo if getattr(self, 'author', None) else None,
            "content": self.content,
            "image_url": self.image_url,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "likes_count": self.likes_count,
            "comments_count": len(self.comments)
        }

class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class PostComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "user_id": self.user_id,
            "author_name": self.author.name if getattr(self, 'author', None) else "Unknown",
            "author_photo": self.author.profile_photo if getattr(self, 'author', None) else None,
            "content": self.content,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }


