// react router dom imports
import { useNavigate } from "react-router-dom";

//  hooks
import useAxios from "./../hooks/useAxios";
import useFirebaseMethods from "./useFirebaseMethods";

// normal axios import
import axios from "axios";

// redux
import { useDispatch, useSelector } from "react-redux";
import { authActions } from "../features/auth/authSlice";

// api endpoints
import { userCreationEndpoint, userCheckEndpoint } from "../data/apiData";

// img bb api related
const imageUploadAPIKey = import.meta.env.VITE_imgbbApiKey;
const imageUploadAPI = `https://api.imgbb.com/1/upload?key=${imageUploadAPIKey}`;

const {
  setUserAlreadyRegistered,
  setAppLoading,
  setUserShouldExist,
  setProfileData,
  setRegistrationErrors,
} = authActions;

// custom hook body starts here
const useRegistrationForm = () => {
  // extract functions from auth context
  const dispatch = useDispatch();
  const { registrationErrors } = useSelector((store) => store.auth);

  const { signup, updateUserProfile } = useFirebaseMethods();

  // axios extraction
  const { axiosCustom } = useAxios();

  // create the navigate function
  const navigate = useNavigate();

  // registration password validation
  const validatePassword = (password) => {
    const passwordErrors = [];

    const capitalLetterRegExp = /[A-Z]/;
    const specialCharsRegExp = /[!@#$%^&*()_+{}[\]:;<>,.?~\\-]/;

    if (password.length < 6) {
      passwordErrors.push("Passwords must be 6 characters");
    }

    if (!capitalLetterRegExp.test(password)) {
      passwordErrors.push("Passwords must contain a capital letter");
    }

    if (!specialCharsRegExp.test(password)) {
      passwordErrors.push("Passwords must contain a special character");
    }

    return passwordErrors;
  };

  const validateInputs = (inputs) => {
    const { userName, photo, email, password } = inputs;
    const emailRegex = /[a-z0-9._]+@[a-z0-9]+.[a-z]+/g;

    const foundErrors = [];

    if (userName === "") {
      foundErrors.push("Must provide an username");
    }

    if (!photo) {
      foundErrors.push("Must provide a photo");
    }

    if (email === "") {
      foundErrors.push("Must provide an email address");
    } else if (!emailRegex.test(email)) {
      foundErrors.push("Must provide a valid email address");
    }

    if (password === "") {
      foundErrors.push("Must provide a password");
    } else {
      foundErrors.push(...validatePassword(password));
    }

    return foundErrors;
  };

  // function to run when the form is submitted
  const handleSubmit = async (e) => {
    e.preventDefault();
    // reset errors
    dispatch(setRegistrationErrors([]));

    const form = e.target;
    const userName = form.name.value;
    const photo = form.file.files[0];
    const email = form.email.value;
    const password = form.password.value;

    const dataObject = {
      userName,
      photo,
      email,
      password,
    };

    const foundErrors = validateInputs(dataObject);

    // if there are errors return from here
    if (foundErrors.length > 0) {
      dispatch(setRegistrationErrors(foundErrors));
      return;
    }

    // if there are no basic errors code will reach this line
    try {
      dispatch(setAppLoading(true));
      const userExistsResponse = await axiosCustom.post(userCheckEndpoint, {
        email: dataObject.email,
      });

      // if user exists
      if (userExistsResponse.data.userExists) {
        dispatch(setUserAlreadyRegistered(true));
        dispatch(setAppLoading(false));
      } else {
        // if user doesn't exist
        // upload image to imgbb first
        const image = { image: dataObject.photo };
        const imageUploadResponse = await axios.post(imageUploadAPI, image, {
          headers: {
            "content-type": "multipart/form-data",
          },
        });

        // if upload to imgbb is successful then proceed to sign up in firebase
        if (imageUploadResponse.data.success) {
          const signupResponse = await signup(
            dataObject.email,
            dataObject.password === "" ? "test" : dataObject.password
          );

          if (signupResponse.user) {
            // if firebase sign up successful update the profile first
            await updateUserProfile(
              dataObject.userName,
              imageUploadResponse.data.data.display_url
            );

            // save new user object to database
            const websiteUser = {
              fullname: dataObject.userName,
              password: dataObject.password,
              email: dataObject.email,
              imageSource: imageUploadResponse.data.data.display_url,
              position: "developer",
            };

            // create user api call
            const userCreationResponse = await axiosCustom.post(
              userCreationEndpoint,
              websiteUser
            );

            // if success
            if (userCreationResponse.data.success) {
              dispatch(setProfileData(userCreationResponse.data.user));
              dispatch(setUserShouldExist(true));
              localStorage.setItem(
                "tokenExists",
                userCreationResponse.data.tokenExists
              );
              navigate("/");
              dispatch(setAppLoading(false));
            }
          }
        }
      }
    } catch (error) {
      if (error) {
        dispatch(setAppLoading(false));
        dispatch(setRegistrationErrors([error.message]));
      }
    }
  };

  return {
    dispatch,
    registrationErrors,
    setRegistrationErrors,
    handleSubmit,
  };
};

export default useRegistrationForm;
