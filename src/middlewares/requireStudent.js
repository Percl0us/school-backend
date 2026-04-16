import jwt from "jsonwebtoken";

export const requireStudent = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== "student") {
      return res.status(403).json({ error: "Access denied: student only" });
    }
    
    req.user = decoded; // { admissionNo, academicYear, role, name, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};