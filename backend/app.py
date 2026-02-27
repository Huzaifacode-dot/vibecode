import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import jwt
from datetime import datetime, timedelta
from functools import wraps
from models import User, Skill, Interest, Event, EventParticipant, Message, Connection, Post, PostLike, PostComment, Subject, AttendanceRecord
from database import db
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.linear_model import LogisticRegression

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
# Enable CORS for all routes so frontend can connect easily
CORS(app)

# Configuration
app.config['SECRET_KEY'] = 'your_secret_key_here_for_jwt' # In prod, read from env
basedir = os.path.abspath(os.path.dirname(__name__))
# Try connecting to MySQL. Change root:password if your Workbench has different credentials
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:password@127.0.0.1:3306/campusconnect'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# --- AUTHENTICATION DECORATOR ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1] if " " in request.headers['Authorization'] else request.headers['Authorization']
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['user_id']).first()
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# --- 1. USER AUTHENTICATION & PROFILE ---

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    branch = data.get('branch', '')
    year = data.get('year', '')

    if not name or not email or not password:
        return jsonify({"message": "Missing fields"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "User already exists"}), 400

    hashed_password = generate_password_hash(password)
    new_user = User(
        name=name, 
        email=email, 
        password_hash=hashed_password,
        branch=branch,
        year=year
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"message": "Missing fields"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid email or password"}), 401

    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({"token": token, "user": user.to_dict()}), 200

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({"user": current_user.to_dict()}), 200

@app.route('/api/add_skills', methods=['POST'])
@token_required
def add_skills(current_user):
    data = request.get_json()
    skills_list = data.get('skills', [])
    interests_list = data.get('interests', [])

    # Clear old skills and interests for simplicity of update
    Skill.query.filter_by(user_id=current_user.id).delete()
    Interest.query.filter_by(user_id=current_user.id).delete()

    for skill_name in skills_list:
        if skill_name.strip():
            db.session.add(Skill(user_id=current_user.id, skill_name=skill_name.strip().lower()))
            
    for interest_name in interests_list:
        if interest_name.strip():
            db.session.add(Interest(user_id=current_user.id, interest_name=interest_name.strip().lower()))
            
    db.session.commit()
    return jsonify({"message": "Skills and interests updated successfully", "user": current_user.to_dict()}), 200

# --- 2. SMART STUDENT MATCHING (Recommend Project Partners) ---
@app.route('/api/recommend_students', methods=['GET'])
@token_required
def recommend_students(current_user):
    users = User.query.all()
    if len(users) < 2:
        return jsonify({"recommendations": []}), 200

    # Build dataset
    user_data = []
    for u in users:
        user_skills = [s.skill_name for s in u.skills]
        user_data.append({
            "id": u.id,
            "skills": user_skills
        })
    
    df = pd.DataFrame(user_data)
    
    # Machine Learning Details: Convert skills into binary vectors
    mlb = MultiLabelBinarizer()
    skill_vectors = mlb.fit_transform(df['skills'])
    
    current_idx = df.index[df['id'] == current_user.id].tolist()[0]
    
    # Use cosine similarity
    similarity_matrix = cosine_similarity(skill_vectors)
    my_similarities = similarity_matrix[current_idx]
    
    # Sort and get top 5 (excluding self)
    similar_indices = my_similarities.argsort()[::-1]
    similar_indices = [i for i in similar_indices if i != current_idx][:5]
    
    recommendations = []
    for idx in similar_indices:
        sim_score = my_similarities[idx]
        if sim_score > 0: # Only recommend if they share at least 1 skill
            match_user = User.query.get(int(df.iloc[idx]['id']))
            match_dict = match_user.to_dict()
            match_dict['similarity_score'] = round(sim_score * 100, 2)
            recommendations.append(match_dict)

    return jsonify({"recommendations": recommendations}), 200

# --- 3. EVENT SYSTEM ---
@app.route('/api/create_event', methods=['POST'])
@token_required
def create_event(current_user):
    data = request.get_json()
    new_event = Event(
        creator_id=current_user.id,
        title=data.get('title'),
        description=data.get('description'),
        date=data.get('date'),
        tags=data.get('tags', '')
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({"message": "Event created successfully", "event": new_event.to_dict()}), 201

@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify({"events": [e.to_dict() for e in events]}), 200

@app.route('/api/join_event', methods=['POST'])
@token_required
def join_event(current_user):
    data = request.get_json()
    event_id = data.get('event_id')
    
    event = Event.query.get(event_id)
    if not event:
        return jsonify({"message": "Event not found"}), 404
        
    if EventParticipant.query.filter_by(event_id=event_id, user_id=current_user.id).first():
        return jsonify({"message": "Already joined"}), 400
        
    participant = EventParticipant(event_id=event_id, user_id=current_user.id)
    db.session.add(participant)
    db.session.commit()
    
    return jsonify({"message": "Joined event successfully"}), 200

# --- 4. Fake Profile Detection & Trust Score ---

def update_trust_score(user, is_anomaly_flagged):
    # Base score starts at 50
    score = 50
    
    # +5 per skill
    score += len(user.skills) * 5
    
    # +10 per event created
    score += len(user.events_created) * 10
    
    # +2 per message received or connection
    # Here we simplify: if they exist in DB and receive messages
    received_messages = Message.query.filter_by(receiver_id=user.id).count()
    score += received_messages * 2
    
    # Penalties
    sent_messages = Message.query.filter_by(sender_id=user.id).count()
    if sent_messages > 10 and received_messages == 0:
        score -= 10 # Spam penalty
        
    if len(user.skills) == 0:
        score -= 20
        
    if is_anomaly_flagged:
        score -= 50
        
    # Bound between 0 and 100
    user.trust_score = max(0, min(100, score))
    return user.trust_score

@app.route('/api/trust_score/<int:user_id>', methods=['GET'])
@token_required
def get_trust_score(current_user, user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
        
    # Recompute to ensure accuracy
    update_trust_score(user, user.is_suspicious)
    db.session.commit()
    
    return jsonify({"trust_score": user.trust_score}), 200

@app.route('/api/admin/run_fake_detection', methods=['POST'])
@token_required
def run_fake_detection(current_user):
    users = User.query.all()
    if len(users) < 5: 
        return jsonify({"message": "Not enough users for ML detection."}), 200

    features = []
    for u in users:
        num_skills = len(u.skills)
        num_events = len(u.events_created)
        num_interests = len(u.interests)
        num_messages_sent = Message.query.filter_by(sender_id=u.id).count()
        
        features.append([
            num_skills,
            num_events,
            num_interests,
            num_messages_sent
        ])
        
    df = pd.DataFrame(features, columns=['skills', 'events', 'interests', 'messages_sent'])
    
    # Use Isolation Forest for fake profile detection
    model = IsolationForest(contamination=0.1, random_state=42)
    predictions = model.fit_predict(df)
    
    # Predictions: 1 for normal, -1 for anomaly
    suspicious_count = 0
    for i, u in enumerate(users):
        is_sus = bool(predictions[i] == -1)
        
        # Determine anomaly flag
        flagged = False
        if is_sus and len(u.skills) == 0:
            flagged = True
        elif is_sus and df.iloc[i]['messages_sent'] > 5: # Spam behavior anomaly
            flagged = True
        elif is_sus:
             flagged = True
             
        u.is_suspicious = flagged
        if flagged:
            suspicious_count += 1
            
        # Update trust score based on new flag
        update_trust_score(u, flagged)
            
    db.session.commit()
    return jsonify({"message": f"Detection complete. {suspicious_count} accounts flagged."}), 200

@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users(current_user):
    users = User.query.all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200

# --- 5. Messaging System ---
@app.route('/api/chat', methods=['POST'])
@token_required
def send_message(current_user):
    data = request.get_json()
    receiver_id = data.get('receiver_id')
    content = data.get('content')

    if not receiver_id or not content:
        return jsonify({"message": "Missing fields"}), 400

    new_msg = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        content=content
    )
    db.session.add(new_msg)
    db.session.commit()
    return jsonify({"message": "Message sent"}), 201

@app.route('/api/chat/<int:user_id>', methods=['GET'])
@token_required
def get_chat(current_user, user_id):
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.receiver_id == current_user.id))
    ).order_by(Message.timestamp.asc()).all()
    
    return jsonify({"messages": [m.to_dict() for m in messages]}), 200

# --- 6. Skill Gap Analyzer ---
from models import ProjectRequirement
import numpy as np

@app.route('/api/projects', methods=['GET'])
@token_required
def get_projects(current_user):
    projects = ProjectRequirement.query.all()
    return jsonify({"projects": [p.to_dict() for p in projects]}), 200

@app.route('/api/skill_gap', methods=['POST'])
@token_required
def analyze_skill_gap(current_user):
    data = request.get_json()
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({"message": "Project ID required"}), 400

    project = ProjectRequirement.query.get(project_id)
    if not project:
        return jsonify({"message": "Project not found"}), 404

    req_skills = [s.strip().lower() for s in project.required_skills.split(',') if s.strip()]
    user_skills = [s.skill_name.lower() for s in current_user.skills]

    # Use MultiLabelBinarizer to convert skills to binary vectors
    mlb = MultiLabelBinarizer()
    
    # Fit on all possible skills in this space (union of both)
    all_skills = list(set(req_skills + user_skills))
    
    if not all_skills:
        return jsonify({"match_score": 0, "missing_skills": req_skills, "recommended_courses": []}), 200

    # We binarize the lists of skills
    mlb.fit([all_skills])
    
    req_vec = mlb.transform([req_skills])[0]
    user_vec = mlb.transform([user_skills])[0]
    
    # Calculate missing skills: where req_vec is 1 and user_vec is 0
    missing_mask = (req_vec == 1) & (user_vec == 0)
    
    # Retrieve the names of the missing skills
    missing_skill_names = mlb.classes_[missing_mask].tolist()
    
    # Calculate match score
    total_required = sum(req_vec)
    if total_required == 0:
         match_score = 100
    else:
         match_score = int(((total_required - len(missing_skill_names)) / total_required) * 100)

    # Dummy recommendations dataset for course mapping
    course_catalog = {
        "python": "Python for Data Science Bootcamp",
        "machine learning": "Intro to Machine Learning with Scikit-Learn",
        "sql": "SQL Database Masterclass",
        "docker": "Docker & Kubernetes Basics",
        "react": "React.js Frontend Development",
        "aws": "AWS Certified Cloud Practitioner",
        "java": "Java Programming Fundamentals"
    }

    recommended_courses = []
    for skill in missing_skill_names:
        course = course_catalog.get(skill, f"Foundations of {skill.capitalize()}")
        recommended_courses.append(course)

    return jsonify({
        "match_score": match_score,
        "missing_skills": [s.title() for s in missing_skill_names],
        "recommended_courses": recommended_courses
    }), 200

# --- 7. Attendance Tracker & ML Risk Prediction ---
from models import Subject, AttendanceRecord
from sklearn.linear_model import LogisticRegression

@app.route('/api/attendance_summary/<int:user_id>', methods=['GET'])
@token_required
def get_attendance_summary(current_user, user_id):
    if current_user.id != user_id and not current_user.is_admin:
        return jsonify({"message": "Unauthorized"}), 403
        
    records = AttendanceRecord.query.filter_by(user_id=user_id).all()
    summary = []
    
    for r in records:
        subj = r.subject
        perc = (r.classes_attended / subj.total_classes) * 100 if subj.total_classes > 0 else 0
        
        # Bunkable classes: (total * 0.25) allowed misses - (total - attended) actual misses
        allowed_misses = int(subj.total_classes * 0.25)
        actual_misses = subj.total_classes - r.classes_attended
        can_bunk_more = allowed_misses - actual_misses
        
        status = "Safe"
        if can_bunk_more < 0:
            status = "Low Attendance"
        elif can_bunk_more <= 2:
            status = "Risk"
            
        summary.append({
            "subject_id": subj.id,
            "subject": subj.subject_name,
            "attendance_percentage": round(perc, 2),
            "classes_attended": r.classes_attended,
            "total_classes": subj.total_classes,
            "can_bunk_more": can_bunk_more,
            "status": status,
            "recent_absences_last_5": r.recent_absences_last_5,
            "days_since_last_present": r.days_since_last_present
        })
        
    return jsonify({"attendance": summary}), 200

@app.route('/api/mark_attendance', methods=['POST'])
@token_required
def mark_attendance(current_user):
    data = request.get_json()
    subject_id = data.get('subject_id')
    attended = data.get('attended', True) # boolean for this single class
    
    record = AttendanceRecord.query.filter_by(user_id=current_user.id, subject_id=subject_id).first()
    if not record:
        return jsonify({"message": "Record not found"}), 404
        
    # Logic simulating a new class occurring
    record.subject.total_classes += 1
    
    if attended:
        record.classes_attended += 1
        record.days_since_last_present = 0
        record.recent_absences_last_5 = max(0, record.recent_absences_last_5 - 1)
    else:
        record.days_since_last_present += 1
        record.recent_absences_last_5 = min(5, record.recent_absences_last_5 + 1)
        
    db.session.commit()
    return jsonify({"message": "Attendance marked successfully"}), 200

# Global ML model strictly for hackathon demo persistency
attendance_ml_model = None

@app.route('/api/train_attendance_model', methods=['POST'])
@token_required
def train_attendance_model(current_user):
    global attendance_ml_model
    if not current_user.is_admin:
         return jsonify({"message": "Unauthorized"}), 403
         
    records = AttendanceRecord.query.all()
    if len(records) < 5:
        return jsonify({"message": "Not enough data to train."}), 200
        
    X = []
    y = []
    
    for r in records:
        total = r.subject.total_classes
        attended = r.classes_attended
        perc = (attended / total) * 100 if total > 0 else 0
        user = r.user
        
        # Extract features
        features = [
            total,
            attended,
            r.recent_absences_last_5,
            perc,
            r.days_since_last_present,
            len(user.events_created), # proxy for events_joined engagement
            len(user.skills)
        ]
        
        # Target label (1 if < 75%, 0 otherwise)
        label = 1 if perc < 75 else 0
        
        X.append(features)
        y.append(label)
        
    # In case the data is too homogeneous to split/predict properly
    if len(set(y)) < 2:
         return jsonify({"message": "Need both Safe and Risky profile data to train model."}), 200
         
    attendance_ml_model = LogisticRegression(max_iter=1000)
    attendance_ml_model.fit(X, y)
    
    return jsonify({"message": "Model trained successfully."}), 200

@app.route('/api/predict_attendance_risk/<int:user_id>', methods=['GET'])
@token_required
def predict_attendance_risk(current_user, user_id):
    if current_user.id != user_id and not current_user.is_admin:
        return jsonify({"message": "Unauthorized"}), 403
        
    # Auto-train model on the fly using ALL attendance records
    records = AttendanceRecord.query.all()
    if len(records) < 5:
        return jsonify({"message": "Not enough data to train AI model."}), 400
    
    X = []
    y = []
    for r in records:
        total = r.subject.total_classes
        attended = r.classes_attended
        perc = (attended / total) * 100 if total > 0 else 0
        user = r.user
        
        features = [
            total,
            attended,
            r.recent_absences_last_5,
            perc,
            r.days_since_last_present,
            len(user.events_created),
            len(user.skills)
        ]
        label = 1 if perc < 75 else 0
        X.append(features)
        y.append(label)
    
    if len(set(y)) < 2:
        return jsonify({"message": "Need both Safe and Risky profile data to train model."}), 400
    
    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)
        
    # Now predict for the requested user
    user_records = AttendanceRecord.query.filter_by(user_id=user_id).all()
    predictions = []
    
    for r in user_records:
        total = r.subject.total_classes
        attended = r.classes_attended
        perc = (attended / total) * 100 if total > 0 else 0
        user = r.user
        
        features = [[
            total,
            attended,
            r.recent_absences_last_5,
            perc,
            r.days_since_last_present,
            len(user.events_created),
            len(user.skills)
        ]]
        
        risk_prob = model.predict_proba(features)[0][1]
        
        status = "HIGH RISK" if risk_prob > 0.70 else ("Medium Risk" if risk_prob > 0.40 else "Safe")
        
        rec = "You are on track."
        if perc < 75:
            x_needed = int(((0.75 * total) - attended) / 0.25)
            if x_needed > 0:
                 rec = f"Attend next {x_needed} classes to stay safe."
            else:
                 rec = "Attend the next class to be safe."
                 
        predictions.append({
            "subject_id": r.subject_id,
            "subject": r.subject.subject_name,
            "attendance_percentage": round(perc, 2),
            "risk_probability": round(risk_prob, 2),
            "status": status,
            "recommendation": rec
        })
        
    return jsonify({"predictions": predictions}), 200

# --- 7. NEW SAAS FEATURES ---

from werkzeug.utils import secure_filename
import os

UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    from flask import send_from_directory
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/user/<int:user_id>', methods=['GET'])
@token_required
def get_public_profile(current_user, user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
        
    return jsonify({
        "id": user.id,
        "name": user.name,
        "branch": user.branch,
        "year": user.year,
        "bio": user.bio,
        "trust_score": user.trust_score,
        "profile_photo": user.profile_photo,
        "skills": [s.skill_name for s in user.skills],
        "interests": [i.interest_name for i in user.interests],
        "events_created": len(user.events_created),
        "posts_count": len(user.posts)
    }), 200

@app.route('/api/upload_profile_photo', methods=['POST'])
@token_required
def upload_profile_photo(current_user):
    if 'profile_photo' not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files['profile_photo']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
        
    if file:
        from werkzeug.utils import secure_filename # ensuring it exists here or globally
        filename = secure_filename(f"user_{current_user.id}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # update user
        current_user.profile_photo = f"/uploads/{filename}"
        db.session.commit()
        return jsonify({"message": "Photo uploaded successfully", "profile_photo_url": current_user.profile_photo}), 200

@app.route('/api/recent_chats', methods=['GET'])
@token_required
def get_recent_chats(current_user):
    # Fetch all messages where user is sender or receiver
    messages = Message.query.filter(
        (Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)
    ).order_by(Message.timestamp.desc()).all()
    
    # Group by the other person
    chat_dict = {}
    for msg in messages:
        other_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        if other_id not in chat_dict:
            other_user = User.query.get(other_id)
            if other_user:
                chat_dict[other_id] = {
                    "other_user_id": other_user.id,
                    "other_user_name": other_user.name,
                    "other_user_photo": other_user.profile_photo,
                    "latest_message": msg.content,
                    "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_unread": msg.is_read == False and msg.receiver_id == current_user.id
                }
                
    return jsonify({"recent_chats": list(chat_dict.values())}), 200

@app.route('/api/create_post', methods=['POST'])
@token_required
def create_post(current_user):
    # Handle text or multipart form
    content = request.form.get('content') or ""
    if not content and request.is_json:
        data = request.get_json()
        content = data.get('content', '')
        
    image_url = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename != '':
            filename = secure_filename(f"post_{current_user.id}_{file.filename}")
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            image_url = f"/uploads/{filename}"
            
    if not content and not image_url:
         return jsonify({"message": "Post cannot be empty"}), 400
         
    new_post = Post(user_id=current_user.id, content=content, image_url=image_url)
    db.session.add(new_post)
    db.session.commit()
    

    return jsonify({"message": "Post created", "post": new_post.to_dict()}), 201

@app.route('/api/feed', methods=['GET'])
@token_required
def get_feed(current_user):
    posts = Post.query.order_by(Post.created_at.desc()).all()
    feed_data = []

    for p in posts:
        # Check if current user liked this post
        user_has_liked = PostLike.query.filter_by(post_id=p.id, user_id=current_user.id).first() is not None

        post_dict = p.to_dict()
        post_dict['user_has_liked'] = user_has_liked
        post_dict['comments_data'] = [c.to_dict() for c in p.comments]

        feed_data.append(post_dict)

    return jsonify({"feed": feed_data}), 200


@app.route('/api/like_post', methods=['POST'])
@token_required
def like_post(current_user):
    data = request.get_json()
    post_id = data.get('post_id')

    post = Post.query.get(post_id)
    if not post:
         return jsonify({"message": "Post not found"}), 404
         
    existing_like = PostLike.query.filter_by(post_id=post.id, user_id=current_user.id).first()
    
    if existing_like:
         db.session.delete(existing_like)
         post.likes_count -= 1
         msg = "Unliked"
    else:
         new_like = PostLike(post_id=post.id, user_id=current_user.id)
         db.session.add(new_like)
         post.likes_count += 1
         msg = "Liked"
         
    db.session.commit()
    return jsonify({"message": msg, "likes_count": post.likes_count}), 200

@app.route('/api/comment_post', methods=['POST'])
@token_required
def comment_post(current_user):
    data = request.get_json()
    post_id = data.get('post_id')
    content = data.get('content')
    
    if not post_id or not content:
         return jsonify({"message": "Missing fields"}), 400
         
    comment = PostComment(post_id=post_id, user_id=current_user.id, content=content)
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({"message": "Comment added", "comment": comment.to_dict()}), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)
